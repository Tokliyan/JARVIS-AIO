--[[--
Ask JARVIS — type a command on the Kindle, read the answer.

All the thinking happens on the JARVIS server (Render). This plugin only does
two things: send the sentence you typed, and show the text that comes back.
That is deliberate: it means new commands and layouts ship by pushing to
GitHub, and this file almost never needs to change.

Settings live in koreader/settings/askjarvis.lua:
    return { base_url = "https://jarvis-aio.onrender.com", token = "..." }
--]]

local Blitbuffer = require("ffi/blitbuffer")
local DataStorage = require("datastorage")
local Device = require("device")
local Dispatcher = require("dispatcher")
local FrameContainer = require("ui/widget/container/framecontainer")
local Font = require("ui/font")
local Geom = require("ui/geometry")
local GestureRange = require("ui/gesturerange")
local ImageWidget = require("ui/widget/imagewidget")
local InfoMessage = require("ui/widget/infomessage")
local InputContainer = require("ui/widget/container/inputcontainer")
local InputDialog = require("ui/widget/inputdialog")
local JSON = require("json")
local LuaSettings = require("luasettings")
local NetworkMgr = require("ui/network/manager")
local TextViewer = require("ui/widget/textviewer")
local TextWidget = require("ui/widget/textwidget")
local UIManager = require("ui/uimanager")
local WidgetContainer = require("ui/widget/container/widgetcontainer")
local ltn12 = require("ltn12")
local logger = require("logger")
local socketutil = require("socketutil")
local _ = require("gettext")

local Screen = Device.screen

local MAX_RECENT = 8
local ENDPOINT = "/api/kindle/command"
local PAGE_ENDPOINT = "/api/kindle/page"
-- Swipe order for the main pages. Longer views (stories, project tabs) send
-- their own swipe zones, so this is only the fallback.
local PAGE_ORDER = { "home", "weather", "projects", "news" }
local REFRESH_SECONDS = 15 * 60

local AskJarvis = WidgetContainer:extend{
    name = "askjarvis",
    is_doc_only = false,
}

local function trim(s)
    return ((s or ""):gsub("^%s+", ""):gsub("%s+$", ""))
end

function AskJarvis:init()
    self.settings = LuaSettings:open(DataStorage:getSettingsDir() .. "/askjarvis.lua")
    self:onDispatcherRegisterActions()
    self.ui.menu:registerToMainMenu(self)
end

-- Lets you bind "JARVIS dashboard" to a gesture (Settings > Taps and gestures)
-- so one tap or swipe flips from your book to the dashboard.
function AskJarvis:onDispatcherRegisterActions()
    Dispatcher:registerAction("askjarvis_dashboard", {
        category = "none",
        event = "ShowJarvisDashboard",
        title = _("JARVIS dashboard"),
        general = true,
    })
end

function AskJarvis:onShowJarvisDashboard()
    self:openDashboard()
    return true
end

function AskJarvis:addToMainMenu(menu_items)
    menu_items.askjarvis = {
        text = _("Ask JARVIS"),
        sorting_hint = "more_tools",
        sub_item_table = {
            {
                text = _("Dashboard"),
                callback = function() self:openDashboard() end,
            },
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

-- ---------------------------------------------------------------- dashboard
-- The pages are pictures drawn by the server (home, weather, news, stories,
-- projects). This view shows one, works out what a tap or swipe means from the
-- "zones" the server sends back, and refreshes itself every 15 minutes.
--
-- A zone looks like { x, y, w, h, go, id?, tab?, pg?, swipe? } where x/y/w/h
-- are fractions of the screen. Tapping inside it asks the server for page
-- `go` with whichever of id/tab/pg are set. A zone with `swipe` ("west" or
-- "east") is what that swipe does, not a tap target.

local function urlEncode(s)
    return (tostring(s):gsub("[^%w%-_%.~]", function(c) return string.format("%%%02X", string.byte(c)) end))
end

local function pageIndex(page)
    for i, p in ipairs(PAGE_ORDER) do
        if p == page then return i end
    end
    return nil
end

-- Returns (png_bytes, zones_table, nil) or (nil, nil, message).
-- params may hold id, tab and pg.
function AskJarvis:fetchPage(page, params)
    local base = trim(self.settings:readSetting("base_url"))
    local token = trim(self.settings:readSetting("token"))
    if base == "" or token == "" then
        return nil, nil, _("Set the server address and access token first (Ask JARVIS menu).")
    end
    base = base:gsub("/+$", "")

    local url = string.format("%s%s?p=%s&w=%d&h=%d", base, PAGE_ENDPOINT, urlEncode(page), Screen:getWidth(), Screen:getHeight())
    for _i, key in ipairs({ "id", "tab", "pg" }) do
        local v = params and params[key]
        if v ~= nil then url = url .. "&" .. key .. "=" .. urlEncode(v) end
    end

    local requester = require("socket.http")
    if base:match("^https") then requester = require("ssl.https") end
    local body = {}
    socketutil:set_timeout(20, 60)
    local ok, result, code, headers = pcall(requester.request, {
        url = url,
        method = "GET",
        headers = { ["Authorization"] = "Bearer " .. token },
        sink = socketutil.table_sink and socketutil.table_sink(body) or ltn12.sink.table(body),
    })
    socketutil:reset_timeout()

    if not ok or result == nil then
        logger.warn("askjarvis: dashboard request failed", result, code)
        return nil, nil, _("Couldn't reach the server. Check Wi-Fi and the address.")
    end
    if code == 401 then return nil, nil, _("The server rejected the access token.") end
    if code ~= 200 then return nil, nil, _("Server error ") .. tostring(code) end

    local zones = {}
    local raw = headers and headers["x-kindle-zones"]
    if raw then
        local zok, decoded = pcall(JSON.decode, raw)
        if zok and type(decoded) == "table" then zones = decoded end
    end
    return table.concat(body), zones, nil
end

local DashboardView = InputContainer:extend{
    plugin = nil,
    page = "home",
    params = nil,
    zones = nil,
    covers_fullscreen = true,
}

function DashboardView:init()
    self.dimen = Geom:new{ x = 0, y = 0, w = Screen:getWidth(), h = Screen:getHeight() }
    self.ges_events = {
        TapDash = { GestureRange:new{ ges = "tap", range = self.dimen } },
        SwipeDash = { GestureRange:new{ ges = "swipe", range = self.dimen } },
    }
    if Device:hasKeys() then
        self.key_events = { CloseDash = { { "Back" } } }
    end
    self.zones = {}
    self.params = self.params or {}
    self.image_path = DataStorage:getDataDir() .. "/cache/askjarvis_dash.png"
    self[1] = FrameContainer:new{
        background = Blitbuffer.COLOR_WHITE,
        bordersize = 0,
        padding = 0,
        margin = 0,
        TextWidget:new{ text = _("Loading…"), face = Font:getFace("cfont", 28) },
    }
    self.auto_refresh = function()
        self:load(self.page, self.params, "full", true)
        UIManager:scheduleIn(REFRESH_SECONDS, self.auto_refresh)
    end
end

function DashboardView:onShow()
    -- Keep the Kindle awake and online while the dashboard is up.
    UIManager:preventStandby()
    if Device:isKindle() then
        pcall(os.execute, "lipc-set-prop com.lab126.powerd preventScreenSaver 1 2>/dev/null")
    end
    UIManager:scheduleIn(REFRESH_SECONDS, self.auto_refresh)
    self:load(self.page, self.params, "full")
end

function DashboardView:onCloseWidget()
    UIManager:unschedule(self.auto_refresh)
    UIManager:allowStandby()
    if Device:isKindle() then
        pcall(os.execute, "lipc-set-prop com.lab126.powerd preventScreenSaver 0 2>/dev/null")
    end
    UIManager:setDirty(nil, "full")
end

function DashboardView:onCloseDash()
    UIManager:close(self)
    return true
end

-- Fetch a page and swap the picture in. mode: "partial" (quick) or "full" (flash).
function DashboardView:load(page, params, mode, silent)
    NetworkMgr:runWhenOnline(function()
        local busy
        if not silent then
            busy = InfoMessage:new{ text = _("Loading…"), timeout = 30 }
            UIManager:show(busy)
            UIManager:forceRePaint()
        end

        local png, zones, err = self.plugin:fetchPage(page, params)
        if busy then UIManager:close(busy) end
        if not png then
            if not silent then UIManager:show(InfoMessage:new{ text = err }) end
            return
        end

        local f = io.open(self.image_path, "wb")
        if not f then
            if not silent then UIManager:show(InfoMessage:new{ text = _("Couldn't save the page.") }) end
            return
        end
        f:write(png)
        f:close()

        pcall(function() self[1][1]:free() end)
        self.page = page
        self.params = params or {}
        self.zones = zones
        self[1] = FrameContainer:new{
            background = Blitbuffer.COLOR_WHITE,
            bordersize = 0,
            padding = 0,
            margin = 0,
            ImageWidget:new{
                file = self.image_path,
                width = Screen:getWidth(),
                height = Screen:getHeight(),
                scale_factor = 0,
                file_do_cache = false,
            },
        }
        UIManager:setDirty(self, mode or "partial")
    end)
end

-- Do what a zone says: close, or load another page with its id/tab/pg.
function DashboardView:go(zone)
    if zone.go == "close" then
        UIManager:close(self)
        return
    end
    self:load(zone.go, { id = zone.id, tab = zone.tab, pg = zone.pg }, "partial")
end

function DashboardView:onTapDash(_arg, ges)
    local fx = (ges.pos.x - self.dimen.x) / self.dimen.w
    local fy = (ges.pos.y - self.dimen.y) / self.dimen.h
    for _i, z in ipairs(self.zones or {}) do
        if not z.swipe and fx >= z.x and fx <= z.x + z.w and fy >= z.y and fy <= z.y + z.h then
            self:go(z)
            return true
        end
    end
    return true
end

-- Swipe left (west) for next, right (east) for previous. The server says what
-- that means on long views (story pages, project lists). Otherwise it moves
-- along Home / Weather / Projects / News.
function DashboardView:onSwipeDash(_arg, ges)
    local dir = ges.direction
    if dir ~= "west" and dir ~= "east" then return true end
    for _i, z in ipairs(self.zones or {}) do
        if z.swipe == dir then
            self:go(z)
            return true
        end
    end
    local i = pageIndex(self.page)
    if i then
        i = (dir == "west") and (i % #PAGE_ORDER) + 1 or ((i - 2) % #PAGE_ORDER) + 1
        self:load(PAGE_ORDER[i], {}, "partial")
    end
    return true
end

function AskJarvis:openDashboard()
    UIManager:show(DashboardView:new{ plugin = self })
end

return AskJarvis
