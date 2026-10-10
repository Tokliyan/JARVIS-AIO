--[[--
Ask JARVIS — type a command on the Kindle, read the answer.

All the thinking happens on the JARVIS server (Render). This plugin only does
two things: send the sentence you typed, and show the text that comes back.
That is deliberate: it means new commands and layouts ship by pushing to
GitHub, and this file almost never needs to change.

Settings live in koreader/settings/askjarvis.lua:
    return { base_url = "https://jarvis-aio.onrender.com", token = "..." }
--]]

local DataStorage = require("datastorage")
local Device = require("device")
local InfoMessage = require("ui/widget/infomessage")
local InputDialog = require("ui/widget/inputdialog")
local JSON = require("json")
local LuaSettings = require("luasettings")
local NetworkMgr = require("ui/network/manager")
local TextViewer = require("ui/widget/textviewer")
local UIManager = require("ui/uimanager")
local WidgetContainer = require("ui/widget/container/widgetcontainer")
local ltn12 = require("ltn12")
local logger = require("logger")
local socketutil = require("socketutil")
local _ = require("gettext")

local Screen = Device.screen

local MAX_RECENT = 8
local ENDPOINT = "/api/kindle/command"

local AskJarvis = WidgetContainer:extend{
    name = "askjarvis",
    is_doc_only = false,
}

local function trim(s)
    return ((s or ""):gsub("^%s+", ""):gsub("%s+$", ""))
end

function AskJarvis:init()
    self.settings = LuaSettings:open(DataStorage:getSettingsDir() .. "/askjarvis.lua")
    self.ui.menu:registerToMainMenu(self)
end

function AskJarvis:addToMainMenu(menu_items)
    menu_items.askjarvis = {
        text = _("Ask JARVIS"),
        sorting_hint = "more_tools",
        sub_item_table = {
            {
                text = _("Ask…"),
                callback = function() self:promptCommand() end,
            },
            {
                text = _("Recent commands"),
                enabled_func = function()
                    local recent = self.settings:readSetting("recent")
                    return recent ~= nil and #recent > 0
                end,
                sub_item_table_func = function() return self:recentItems() end,
            },
            {
                text = _("Server address"),
                keep_menu_open = true,
                callback = function(touchmenu_instance)
                    self:editSetting("base_url", _("Server address"), "https://your-app.onrender.com", touchmenu_instance)
                end,
            },
            {
                text = _("Access token"),
                keep_menu_open = true,
                callback = function(touchmenu_instance)
                    self:editSetting("token", _("Access token"), "KINDLE_COMMAND_TOKEN", touchmenu_instance)
                end,
            },
        },
    }
end

function AskJarvis:editSetting(key, title, hint, touchmenu_instance)
    local dialog
    dialog = InputDialog:new{
        title = title,
        input = self.settings:readSetting(key) or "",
        input_hint = hint,
        buttons = {{
            {
                text = _("Cancel"),
                id = "close",
                callback = function() UIManager:close(dialog) end,
            },
            {
                text = _("Save"),
                is_enter_default = true,
                callback = function()
                    self.settings:saveSetting(key, trim(dialog:getInputText()))
                    self.settings:flush()
                    UIManager:close(dialog)
                    if touchmenu_instance then touchmenu_instance:updateItems() end
                end,
            },
        }},
    }
    UIManager:show(dialog)
    dialog:onShowKeyboard()
end

function AskJarvis:recentItems()
    local items = {}
    for _i, cmd in ipairs(self.settings:readSetting("recent") or {}) do
        table.insert(items, {
            text = cmd,
            callback = function() self:send(cmd) end,
        })
    end
    return items
end

function AskJarvis:remember(cmd)
    local recent = self.settings:readSetting("recent") or {}
    for i = #recent, 1, -1 do
        if recent[i] == cmd then table.remove(recent, i) end
    end
    table.insert(recent, 1, cmd)
    while #recent > MAX_RECENT do table.remove(recent) end
    self.settings:saveSetting("recent", recent)
    self.settings:flush()
end

function AskJarvis:promptCommand(prefill)
    local dialog
    dialog = InputDialog:new{
        title = _("Ask JARVIS"),
        input = prefill or "",
        input_hint = _("e.g. pull up doc 3 for chem notes"),
        buttons = {{
            {
                text = _("Cancel"),
                id = "close",
                callback = function() UIManager:close(dialog) end,
            },
            {
                text = _("Send"),
                is_enter_default = true,
                callback = function()
                    local text = trim(dialog:getInputText())
                    UIManager:close(dialog)
                    if text ~= "" then self:send(text) end
                end,
            },
        }},
    }
    UIManager:show(dialog)
    dialog:onShowKeyboard()
end

-- Returns (table, nil) on success or (nil, message) on any failure.
function AskJarvis:post(text)
    local base = trim(self.settings:readSetting("base_url"))
    local token = trim(self.settings:readSetting("token"))
    if base == "" or token == "" then
        return nil, _("Set the server address and access token first (Ask JARVIS menu).")
    end
    base = base:gsub("/+$", "")

    local payload = JSON.encode({ text = text })
    local body = {}
    local requester = require("socket.http")
    if base:match("^https") then requester = require("ssl.https") end

    -- Generating study material can take a while, so allow a long total time.
    socketutil:set_timeout(20, 150)
    local ok, result, code = pcall(requester.request, {
        url = base .. ENDPOINT,
        method = "POST",
        headers = {
            ["Content-Type"] = "application/json",
            ["Content-Length"] = tostring(#payload),
            ["Authorization"] = "Bearer " .. token,
        },
        source = ltn12.source.string(payload),
        sink = socketutil.table_sink and socketutil.table_sink(body) or ltn12.sink.table(body),
    })
    socketutil:reset_timeout()

    if not ok then
        logger.warn("askjarvis: request error", result)
        return nil, _("Couldn't reach the server.")
    end
    if result == nil then
        logger.warn("askjarvis: request failed", code)
        return nil, _("Couldn't reach the server. Check Wi-Fi and the address.")
    end

    local decoded_ok, decoded = pcall(JSON.decode, table.concat(body))
    if not decoded_ok or type(decoded) ~= "table" then decoded = {} end

    if code == 401 then
        return nil, _("The server rejected the access token.")
    elseif code == 200 and decoded.ok then
        return decoded, nil
    end
    return nil, decoded.error or (_("Server error ") .. tostring(code))
end

function AskJarvis:send(text)
    NetworkMgr:runWhenOnline(function()
        local busy = InfoMessage:new{ text = _("Asking JARVIS…") }
        UIManager:show(busy)
        UIManager:forceRePaint()

        local reply, err = self:post(text)

        UIManager:close(busy)
        if not reply then
            UIManager:show(InfoMessage:new{ text = err })
            return
        end

        self:remember(text)
        self:showReply(reply)
    end)
end

function AskJarvis:showReply(reply)
    local viewer
    viewer = TextViewer:new{
        title = reply.title or _("JARVIS"),
        text = reply.text or "",
        width = Screen:getWidth(),
        height = Screen:getHeight(),
        buttons_table = {{
            {
                text = _("Ask again"),
                callback = function()
                    UIManager:close(viewer)
                    self:promptCommand()
                end,
            },
        }},
    }
    UIManager:show(viewer)
end

return AskJarvis
