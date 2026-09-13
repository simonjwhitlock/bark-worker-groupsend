export default {
    async fetch(request, env, ctx) {
        return await handleRequest(request, env, ctx)
    }
}

async function handleRequest(request, env, ctx) {
    const allowNewDevice = env.ALLOW_NEW_DEVICE !== undefined ? (env.ALLOW_NEW_DEVICE === 'false' ? false : Boolean(env.ALLOW_NEW_DEVICE)) : true
    const allowQueryNums = env.ALLOW_QUERY_NUMS !== undefined ? (env.ALLOW_QUERY_NUMS === 'false' ? false : Boolean(env.ALLOW_QUERY_NUMS)) : true
    const rootPath = env.ROOT_PATH || '/'
    const basicAuth = env.BASIC_AUTH

    const db = new Database(env)
    ctx.waitUntil(db.cleanupExpiredSessions())

    const { searchParams, pathname } = new URL(request.url)
    const handler = new Handler(db, { allowNewDevice, allowQueryNums })
    const realPathname = pathname.replace((new RegExp('^' + rootPath.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'))), '/')

    if (realPathname === '/admin') {
        if (!util.validateBasicAuth(request, basicAuth)) {
            return new Response('Unauthorized', {
                status: 401,
                headers: {
                    'content-type': 'text/plain',
                    'WWW-Authenticate': 'Basic realm="Bark Admin"',
                }
            })
        }
        // Serve the Admin UI - in a real worker, you might use a static asset or a string
        // For simplicity in this implementation, we'll simulate loading the admin.html
        // In a real deployment, the user would put this HTML in the worker or a KV
        return new Response(await getAdminHtml(), {
            headers: { 'content-type': 'text/html; charset=utf-8' }
        })
    }

    if (realPathname.startsWith('/admin/')) {
        if (!util.validateBasicAuth(request, basicAuth)) {
            return new Response('Unauthorized', {
                status: 401,
                headers: {
                    'content-type': 'text/plain',
                    'WWW-Authenticate': 'Basic realm="Bark Admin"',
                }
            })
        }
        return handler.admin(request, db, { allowNewDevice, allowQueryNums })
    }

    switch (realPathname) {
        case '/register': {
            return handler.register(searchParams)
        }
        case '/ping': {
            return handler.ping(searchParams)
        }
        case '/healthz': {
            return handler.healthz(searchParams)
        }
        case '/info': {
            if (!util.validateBasicAuth(request, basicAuth)) {
                return new Response('Unauthorized', {
                    status: 401,
                    headers: {
                        'content-type': 'text/plain',
                        'WWW-Authenticate': 'Basic realm="Bark"',
                    }
                })
            }
            return handler.info(searchParams)
        }
        case '/mcp': {
            if (!util.validateBasicAuth(request, basicAuth)) {
                return new Response('Unauthorized', {
                    status: 401,
                    headers: {
                        'content-type': 'text/plain',
                        'WWW-Authenticate': 'Basic realm="Bark"',
                    }
                })
            }
            return handler.mcp(request, undefined)
        }
        default: {
            const pathParts = realPathname.split('/')

            if (pathParts[1]) {
                if (!util.validateBasicAuth(request, basicAuth)) {
                    return new Response('Unauthorized', {
                        status: 401,
                        headers: {
                            'content-type': 'text/plain',
                            'WWW-Authenticate': 'Basic',
                        }
                    })
                }

                if (pathParts[1] === 'mcp') {
                    return handler.mcp(request, pathParts[2])
                }

                const contentType = request.headers.get('content-type')
                let requestBody = {}

                try {
                    if (contentType && contentType.includes('application/json')) {
                        requestBody = await request.json()

                        requestBody = Object.keys(requestBody).reduce((obj, key) => {
                            obj[key.toLowerCase()] = requestBody[key]
                            return obj
                        }, {})
                    } else if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
                        const formData = await request.formData()
                        formData.forEach((value, key) => { requestBody[key.toLowerCase()] = value })

                        try {
                            if (requestBody.title) {
                                requestBody.title = decodeURIComponent(requestBody.title.replaceAll('\+', '%20'))
                            }

                            if (requestBody.subtitle) {
                                requestBody.subtitle = decodeURIComponent(requestBody.subtitle.replaceAll('\+', '%20'))
                            }

                            if (requestBody.body) {
                                requestBody.body = decodeURIComponent(requestBody.body.replaceAll('\+', '%20'))
                            }

                            if (requestBody.markdown) {
                                requestBody.markdown = decodeURIComponent(requestBody.markdown.replaceAll('\+', '%20'))
                            }
                        } catch (error) {
                            return new Response(JSON.stringify({
                                'code': 500,
                                'message': `url path parse failed: ${error}`,
                                'timestamp': util.getTimestamp(),
                            }), {
                                status: 500,
                                headers: {
                                    'content-type': 'application/json',
                                }
                            })
                        }
                    } else {
                        searchParams.forEach((value, key) => { requestBody[key.toLowerCase()] = value })

                        if (pathParts.length === 3) {
                            requestBody.body = pathParts[2]
                        } else if (pathParts.length === 4) {
                            requestBody.title = pathParts[2]
                            requestBody.body = pathParts[3]
                        } else if (pathParts.length === 5) {
                            requestBody.title = pathParts[2]
                            requestBody.subtitle = pathParts[3]
                            requestBody.body = pathParts[4]
                        } else if (pathParts.length > 5) {
                            return new Response(JSON.stringify({
                                'code': 404,
                                'message': `Cannot ${request.method} ${realPathname}`,
                                'timestamp': util.getTimestamp(),
                            }), {
                                status: 404,
                                headers: {
                                    'content-type': 'application/json',
                                }
                            })
                        }

                        try {
                            if (requestBody.title) {
                                requestBody.title = decodeURIComponent(requestBody.title.replaceAll('\+', '%20'))
                            }

                            if (requestBody.subtitle) {
                                requestBody.subtitle = decodeURIComponent(requestBody.subtitle.replaceAll('\+', '%20'))
                            }

                            if (requestBody.body) {
                                requestBody.body = decodeURIComponent(requestBody.body.replaceAll('\+', '%20'))
                            }

                            if (requestBody.markdown) {
                                requestBody.markdown = decodeURIComponent(requestBody.markdown.replaceAll('\+', '%20'))
                            }
                        } catch (error) {
                            return new Response(JSON.stringify({
                                'code': 500,
                                'message': `url path parse failed: ${error}`,
                                'timestamp': util.getTimestamp(),
                            }), {
                                status: 500,
                                headers: {
                                    'content-type': 'application/json',
                                }
                            })
                        }
                    }

                    if (requestBody.device_keys && typeof requestBody.device_keys === 'string') {
                        if (requestBody.device_keys.startsWith('[') || requestBody.device_keys.endsWith(']')) {
                            requestBody.device_keys = JSON.parse(requestBody.device_keys)
                        } else {
                            requestBody.device_keys = (decodeURIComponent(requestBody.device_keys).trim()).split(',').map(item => item.replace(/['"]/g, '').trim())
                        }

                        if (typeof requestBody.device_keys === 'string') {
                            requestBody.device_keys = [requestBody.device_keys]
                        }
                    }
                } catch (error) {
                    return new Response(JSON.stringify({
                        'code': 400,
                        'message': `request bind failed: ${error}`,
                        'timestamp': util.getTimestamp(),
                    }), {
                        status: 400,
                        headers: {
                            'content-type': 'application/json',
                        }
                    })
                }

                if (requestBody.device_keys && requestBody.device_keys.length > 0) {
                    return new Response(JSON.stringify({
                        'code': 200,
                        'message': 'success',
                        'data': await Promise.all(requestBody.device_keys.map(async (device_key) => {
                            if (!device_key) {
                                return {
                                    code: 400,
                                    message: 'device key is empty',
                                    device_key: device_key,
                                }
                            }

                            const response = await handler.push({ ...requestBody, device_key })
                            const responseBody = await response.json()
                            return {
                                code: response.status,
                                message: responseBody.message,
                                device_key: device_key,
                            }
                        })),
                        'timestamp': util.getTimestamp(),
                    }), {
                        status: 200,
                        headers: {
                            'content-type': 'application/json',
                        }
                    })
                }

                if (realPathname != '/push') {
                    requestBody.device_key = pathParts[1]
                }

                if (!requestBody.device_key) {
                    return new Response(JSON.stringify({
                        'code': 400,
                        'message': 'device key is empty',
                        'timestamp': util.getTimestamp(),
                    }), {
                        status: 400,
                        headers: {
                            'content-type': 'application/json',
                        }
                    })
                }

                return handler.push(requestBody)
            }

            if (realPathname === '/') {
                return new Response('ok', {
                    status: 200,
                    headers: {
                        'content-type': 'text/plain',
                    }
                })
            }

            return new Response(JSON.stringify({
                'code': 404,
                'message': `Cannot ${request.method} ${realPathname}`,
                'timestamp': util.getTimestamp(),
            }), {
                status: 404,
                headers: {
                    'content-type': 'application/json',
                }
            })
        }
    }
}

class Handler {
    constructor(db, options) {
        this.version = 'v2.3.4'
        this.build = '2026-09-12 17:45:41'
        this.arch = 'js'
        this.commit = '3db0918856d5aca4d141300c84d5c7a9f851ba44'
        this.allowNewDevice = options.allowNewDevice
        this.allowQueryNums = options.allowQueryNums

        this.register = async (parameters) => {
            const deviceToken = parameters.get('devicetoken')
            let key = parameters.get('key')

            if (!deviceToken) {
                return new Response(JSON.stringify({
                    'code': 400,
                    'message': 'device token is empty',
                    'timestamp': util.getTimestamp(),
                }), {
                    status: 400,
                    headers: {
                        'content-type': 'application/json',
                    }
                })
            }

            if (deviceToken.length > 160) {
                return new Response(JSON.stringify({
                    'code': 400,
                    'message': 'device token is invalid',
                    'timestamp': util.getTimestamp(),
                }), {
                    status: 400,
                    headers: {
                        'content-type': 'application/json',
                    }
                })
            }

            if (!(key && await db.deviceTokenByKey(key) != undefined)) {
                if (this.allowNewDevice) {
                    key = await util.newShortUUID()
                } else {
                    return new Response(JSON.stringify({
                        'code': 500,
                        'message': 'device registration failed: register disabled',
                    }), {
                        status: 500,
                        headers: {
                            'content-type': 'application/json',
                        }
                    })
                }
            }

            await db.saveDeviceTokenByKey(key, deviceToken)

            return new Response(JSON.stringify({
                'code': 200,
                'message': 'success',
                'timestamp': util.getTimestamp(),
                'data': {
                    'key': key,
                    'device_key': key,
                    'device_token': deviceToken,
                },
            }), {
                status: 200,
                headers: {
                    'content-type': 'application/json',
                }
            })
        }

        this.ping = async (parameters) => {
            return new Response(JSON.stringify({
                'code': 200,
                'message': 'pong',
                'timestamp': util.getTimestamp(),
            }), {
                status: 200,
                headers: {
                    'content-type': 'application/json',
                }
            })
        }

        this.admin = async (request, db, options) => {
            const { method, searchParams } = request
            const path = new URL(request.url).pathname
            
            if (method === 'GET') {
                if (path.endsWith('/devices')) {
                    const devices = await db.getAllDevices()
                    return new Response(JSON.stringify(devices), { headers: { 'content-type': 'application/json' } })
                }
                if (path.endsWith('/groups')) {
                    const groups = await db.getAllGroups()
                    return new Response(JSON.stringify(groups), { headers: { 'content-type': 'application/json' } })
                }
                if (path.endsWith('/settings')) {
                    return new Response(JSON.stringify({
                        allowNewDevice: options.allowNewDevice,
                        allowQueryNums: options.allowQueryNums,
                    }), { headers: { 'content-type': 'application/json' } })
                }
            }

            if (method === 'POST') {
                const body = await request.json()
                if (path.endsWith('/devices')) {
                    const { key, updates } = body
                    await db.updateDevice(key, updates)
                    return new Response(JSON.stringify({ success: true }), { headers: { 'content-type': 'application/json' } })
                }
                if (path.endsWith('/groups')) {
                    const { name, device_keys, id } = body
                    if (id) {
                        // Update existing group - simplified for now, just delete and recreate or update
                        await db.deleteGroup(id)
                    }
                    await db.saveGroup(name, device_keys)
                    return new Response(JSON.stringify({ success: true }), { headers: { 'content-type': 'application/json' } })
                }
                if (path.endsWith('/groups/delete')) {
                    const { id } = body
                    await db.deleteGroup(id)
                    return new Response(JSON.stringify({ success: true }), { headers: { 'content-type': 'application/json' } })
                }
                if (path.endsWith('/settings')) {
                    // Settings are typically env vars in Workers, so we return an error explaining this
                    return new Response(JSON.stringify({ 
                        error: 'Settings are configured via environment variables in Cloudflare Dashboard',
                        success: false 
                    }), { status: 400, headers: { 'content-type': 'application/json' } })
                }
            }

            return new Response('Not Found', { status: 404 })
        }

        this.healthz = async (parameters) => {
            return new Response('ok', {
                status: 200,
                headers: {
                    'content-type': 'text/plain',
                }
            })
        }

        this.info = async (parameters) => {
            if (this.allowQueryNums) {
                this.devices = await db.countAll()
            }

            return new Response(JSON.stringify({
                'version': this.version,
                'build': this.build,
                'arch': this.arch,
                'commit': this.commit,
                'devices': this.devices,
            }), {
                status: 200,
                headers: {
                    'content-type': 'application/json',
                }
            })
        }

        this.push = async (parameters) => {
            const deviceToken = await db.deviceTokenByKey(parameters.device_key)

            if (deviceToken === undefined) {
                return new Response(JSON.stringify({
                    'code': 400,
                    'message': `failed to get device token: failed to get [${parameters.device_key}] device token from database`,
                    'timestamp': util.getTimestamp(),
                }), {
                    status: 400,
                    headers: {
                        'content-type': 'application/json',
                    }
                })
            }

            if (!deviceToken) {
                return new Response(JSON.stringify({
                    'code': 400,
                    'message': 'device token invalid',
                    'timestamp': util.getTimestamp(),
                }), {
                    status: 400,
                    headers: {
                        'content-type': 'application/json',
                    }
                })
            }

            const title = parameters.title || undefined
            const subtitle = parameters.subtitle || undefined
            const body = parameters.body || undefined

            let sound = parameters.sound || undefined
            if (sound) {
                if (!sound.endsWith('.caf')) {
                    sound += '.caf'
                }
            } else {
                sound = '1107'
            }

            const group = parameters.group || undefined
            const call = parameters.call || undefined
            const isArchive = parameters.isarchive || undefined
            const icon = parameters.icon || undefined
            const ciphertext = parameters.ciphertext || undefined
            const level = parameters.level || undefined
            const volume = parameters.volume || undefined
            const url = parameters.url || undefined
            const image = parameters.image || undefined
            const copy = parameters.copy || undefined
            const badge = parameters.badge?.toString()
            const autoCopy = parameters.autocopy || undefined
            const action = parameters.action || undefined
            const iv = parameters.iv || undefined
            const id = parameters.id || undefined
            const _delete = parameters.delete || undefined
            const markdown = parameters.markdown || undefined
            const ttl = parameters.ttl || undefined

            // https://developer.apple.com/documentation/usernotifications/generating-a-remote-notification
            const aps = {
                'aps': (_delete) ? {
                    'content-available': 1,
                    'mutable-content': 1,
                } : {
                    'alert': {
                        'title': title,
                        'subtitle': subtitle,
                        'body': (!title && !subtitle && !body) ? 'Empty Message' : body,
                        'launch-image': undefined,
                        'title-loc-key': undefined,
                        'title-loc-args': undefined,
                        'subtitle-loc-key': undefined,
                        'subtitle-loc-args': undefined,
                        'loc-key': undefined,
                        'loc-args': undefined,
                    },
                    'badge': undefined,
                    'sound': sound,
                    'thread-id': group,
                    'category': 'myNotificationCategory',
                    'content-available': undefined,
                    'mutable-content': 1,
                    'target-content-id': undefined,
                    'interruption-level': undefined,
                    'relevance-score': undefined,
                    'filter-criteria': undefined,
                    'stale-date': undefined,
                    'content-state': undefined,
                    'timestamp': undefined,
                    'event': undefined,
                    'dimissal-date': undefined,
                    'attributes-type': undefined,
                    'attributes': undefined,
                },
                // ExtParams
                'group': group,
                'call': call,
                'isarchive': isArchive,
                'icon': icon,
                'ciphertext': ciphertext,
                'level': level,
                'volume': volume,
                'url': url,
                'copy': copy,
                'badge': badge,
                'autocopy': autoCopy,
                'action': action,
                'iv': iv,
                'image': image,
                'id': id,
                'delete': _delete,
                'markdown': markdown,
                'ttl': ttl,
            }

            const headers = {
                'apns-topic': undefined,
                'apns-id': undefined,
                'apns-collapse-id': id,
                'apns-priority': undefined,
                'apns-expiration': undefined,
                'apns-push-type': (_delete) ? 'background' : 'alert',
            }

            const apns = new APNs(db)
            const response = await apns.push(deviceToken, headers, aps)

            if (response.status === 200) {
                return new Response(JSON.stringify({
                    'code': 200,
                    'message': 'success',
                    'timestamp': util.getTimestamp(),
                }), {
                    status: 200,
                    headers: {
                        'content-type': 'application/json',
                    }
                })
            } else {
                let message
                const responseText = await response.text()

                try {
                    message = JSON.parse(responseText).reason
                } catch (err) {
                    message = responseText
                }

                if ((response.status === 410) || ((response.status === 400) && (message.includes('BadDeviceToken')))) {
                    await db.saveDeviceTokenByKey(parameters.device_key, '')
                }

                return new Response(JSON.stringify({
                    'code': response.status,
                    'message': `push failed: ${message}`,
                    'timestamp': util.getTimestamp(),
                }), {
                    status: response.status,
                    headers: {
                        'content-type': 'application/json',
                    }
                })
            }
        }

        this.mcp = async (request, deviceKey) => {
            if (request.method === 'DELETE') {
                const sessionId = request.headers.get('mcp-session-id')
                if (sessionId) {
                    await db.deleteSessionBySessionID(sessionId)
                }
                return new Response(null, {
                    status: 200
                })
            }

            if (request.method !== 'POST') {
                return new Response(JSON.stringify({
                    'jsonrpc': '2.0',
                    'id': null,
                    'error': {
                        'code': -32700,
                        'message': 'Method not allowed',
                    }
                }), {
                    status: 200,
                    headers: {
                        'content-type': 'application/json',
                    }
                })
            }

            let body = {}
            try {
                body = await request.json()
            } catch (err) {
                return new Response(JSON.stringify({
                    'jsonrpc': '2.0',
                    'id': null,
                    'error': {
                        'code': -32700,
                        'message': 'request body is not valid json',
                    }
                }), {
                    status: 200,
                    headers: {
                        'content-type': 'application/json',
                    }
                })
            }

            const {
                jsonrpc,
                id,
                method,
                params,
            } = body

            if (jsonrpc !== '2.0') {
                return new Response(JSON.stringify({
                    'jsonrpc': '2.0',
                    'id': id || null,
                    'error': {
                        'code': -32600,
                        'message': 'Invalid Request',
                    }
                }), {
                    status: 200,
                    headers: {
                        'content-type': 'application/json',
                    }
                })
            }

            switch (method) {
                case 'initialize': {
                    const sessionId = await util.newMCPSessionUUID()
                    await db.saveSessionBySessionID(sessionId, deviceKey, true, null)

                    return new Response(JSON.stringify({
                        'jsonrpc': '2.0',
                        'id': id,
                        'result': {
                            'protocolVersion': '2025-03-26',
                            'capabilities': {
                                'tools': {
                                    'listChanged': true,
                                },
                            },
                            'serverInfo': {
                                name: deviceKey ? 'Bark MCP Server (Specific)' : 'Bark MCP Server',
                                version: this.version,
                            },
                        }
                    }), {
                        status: 200,
                        headers: {
                            'content-type': 'application/json',
                            'mcp-session-id': sessionId,
                        }
                    })
                }
                case 'notifications/initialized': {
                    const sessionId = request.headers.get('mcp-session-id')
                    const session = await db.sessionBySessionID(sessionId)
                    
                    if (!session) {
                        return new Response(null, {
                            status: 400
                        })
                    }
                    
                    await db.saveSessionBySessionID(session.id, session.device_key, true, undefined)

                    return new Response(null, {
                        status: 202
                    })
                }
                case 'tools/list': {
                    const sessionId = request.headers.get('mcp-session-id')
                    const session = await db.sessionBySessionID(sessionId)
                    
                    if (!session) {
                        return new Response('Invalid session ID', {
                            status: 400,
                            headers: {
                                'content-type': 'text/plain',
                            }
                        })
                    }

                    await db.saveSessionBySessionID(session.id, session.device_key, true, undefined)

                    const sessionDeviceKey = session.device_key
                    const required = sessionDeviceKey ? [] : ['device_key']

                    const properties = {
                        'title':        { 'type': 'string', 'description': 'Notification title' },
                        'subtitle':     { 'type': 'string', 'description': 'Notification subtitle' },
                        'body':         { 'type': 'string', 'description': 'Notification content' },
                        'markdown':     { 'type': 'string', 'description': 'Markdown content, overrides body' },
                        'level':        { 'type': 'string', 'description': 'Notification level', 'enum': ['critical', 'active', 'timeSensitive', 'passive'] },
                        'volume':       { 'type': 'number', 'description': 'Alert volume (0–10)', 'minimum': 0, 'maximum': 10, 'default': 5 },
                        'badge':        { 'type': 'number', 'description': 'Badge number' },
                        'call':         { 'type': 'string', 'description': "Set to '1' to repeat ringtone" },
                        'sound':        { 'type': 'string', 'description': 'Notification sound name' },
                        'icon':         { 'type': 'string', 'description': 'Notification icon URL' },
                        'image':        { 'type': 'string', 'description': 'Notification image URL' },
                        'group':        { 'type': 'string', 'description': 'Notification group' },
                        'isArchive':    { 'type': 'string', 'description': "Set to '1' to archive, other value to skip" },
                        'ttl':          { 'type': 'number', 'description': 'Time to live in seconds for archived messages; expired items are automatically deleted' },
                        'url':          { 'type': 'string', 'description': 'Click action URL' },
                        'copy':         { 'type': 'string', 'description': 'Text to copy on copy action' },
                        'device_key': sessionDeviceKey ? undefined : { 'type': 'string', 'description': 'Device key' },
                    }

                    return new Response(JSON.stringify({
                        'jsonrpc': '2.0',
                        'id': id,
                        'result': {
                            'tools': [
                                {   
                                    'annotations': {
                                        'readOnlyHint': false,
                                        'destructiveHint': true,
                                        'idempotentHint': false,
                                        'openWorldHint': true
                                    },
                                    'name': 'notify',
                                    'description': 'Send a notification to a device via Bark',
                                    'inputSchema': {
                                        'type': 'object',
                                        'properties': properties,
                                        ...(required.length > 0 ? { required } : {})
                                    },
                                },
                            ]
                        }
                    }), {
                        status: 200,
                        headers: {
                            'content-type': 'application/json',
                        }
                    })
                }
                case 'tools/call': {
                    const sessionId = request.headers.get('mcp-session-id')
                    const session = await db.sessionBySessionID(sessionId)
                    
                    if (!session) {
                        return new Response('Invalid session ID', {
                            status: 400,
                            headers: {
                                'content-type': 'text/plain',
                            }
                        })
                    }

                    await db.saveSessionBySessionID(session.id, session.device_key, true, undefined)

                    const { name, arguments: args = {} } = params || {}

                    if (name !== 'notify') {
                        return new Response(JSON.stringify({
                            'jsonrpc': '2.0',
                            'id': id,
                            'error': {
                                'code': -32602,
                                'message': `tool '${name}' not found: tool not found`,
                            }
                        }), {
                            status: 200,
                            headers: {
                                'content-type': 'application/json',
                            }
                        })
                    }

                    const _deviceKey = session.device_key || args.device_key || ''
                    if (!_deviceKey) {
                        return new Response(JSON.stringify({
                            'jsonrpc': '2.0',
                            'id': id,
                            'result': {
                                'content': [
                                    {
                                        'type': 'text',
                                        'text': 'device_key is required',
                                    }
                                ],
                                'isError': true,
                            }
                        }), {
                            status: 200,
                            headers: {
                                'content-type': 'application/json',
                            }
                        })
                    }
                    
                    const parameters = { ...args, 'device_key': _deviceKey }
                    const pushParams = Object.keys(parameters).reduce((obj, key) => {
                        obj[key.toLowerCase()] = parameters[key]
                        return obj
                    }, {})

                    const response = await this.push(pushParams)
                    const responseBody = await response.json()

                    if (response.status === 200) {
                        return new Response(JSON.stringify({
                            'jsonrpc': '2.0',
                            'id': id,
                            'result': {
                                'content': [
                                    {
                                        'type': 'text',
                                        'text': 'Notification sent successfully',
                                    }
                                ]
                            }
                        }), {
                            status: 200,
                            headers: {
                                'content-type': 'application/json',
                            }
                        })
                    }

                    return new Response(JSON.stringify({
                        'jsonrpc': '2.0',
                        'id': id,
                        'result': {
                            'content': [
                                {
                                    'type': 'text',
                                    'text': `Failed to send notification: ${responseBody.message}`,
                                }
                            ],
                            'isError': true,
                        }
                    }), {
                        status: 200,
                        headers: {
                            'content-type': 'application/json',
                        }
                    })

                }
                default: {
                    return new Response(JSON.stringify({
                        'jsonrpc': '2.0',
                        'id': id || null,
                        'error': {
                            'code': -32601,
                            'message': `Method not found: ${method}`,
                        }
                    }), {
                        status: 200,
                        headers: {
                            'content-type': 'application/json',
                        }
                    })
                }
            }
        }
    }
}

class APNs {
    constructor(db) {
        const generateAuthToken = async () => {
            const TOKEN_KEY = `
            -----BEGIN PRIVATE KEY-----
            MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg4vtC3g5L5HgKGJ2+
            T1eA0tOivREvEAY2g+juRXJkYL2gCgYIKoZIzj0DAQehRANCAASmOs3JkSyoGEWZ
            sUGxFs/4pw1rIlSV2IC19M8u3G5kq36upOwyFWj9Gi3Ejc9d3sC7+SHRqXrEAJow
            8/7tRpV+
            -----END PRIVATE KEY-----
            `

            // Parse private key
            const privateKeyPEM = TOKEN_KEY.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\s/g, '')
            // Decode private key
            const privateKeyArrayBuffer = util.base64ToArrayBuffer(privateKeyPEM)
            const privateKey = await crypto.subtle.importKey('pkcs8', privateKeyArrayBuffer, { name: 'ECDSA', namedCurve: 'P-256', }, false, ['sign'])
            const TEAM_ID = '5U8LBRXG3A'
            const AUTH_KEY_ID = 'LH4T9V5U4R'
            // Generate the JWT token
            const JWT_ISSUE_TIME = util.getTimestamp()
            const JWT_HEADER = btoa(JSON.stringify({ alg: 'ES256', kid: AUTH_KEY_ID })).replace('+', '-').replace('/', '_').replace(/=+$/, '')
            const JWT_CLAIMS = btoa(JSON.stringify({ iss: TEAM_ID, iat: JWT_ISSUE_TIME })).replace('+', '-').replace('/', '_').replace(/=+$/, '')
            const JWT_HEADER_CLAIMS = JWT_HEADER + '.' + JWT_CLAIMS
            // Sign
            const jwtArray = new TextEncoder().encode(JWT_HEADER_CLAIMS)
            const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, jwtArray)
            const signatureArray = new Uint8Array(signature)
            const JWT_SIGNED_HEADER_CLAIMS = btoa(String.fromCharCode(...signatureArray)).replace('+', '-').replace('/', '_').replace(/=+$/, '')
            const AUTHENTICATION_TOKEN = JWT_HEADER_CLAIMS + '.' + JWT_SIGNED_HEADER_CLAIMS

            return AUTHENTICATION_TOKEN
        }

        const getAuthToken = async () => {
            let authToken = await db.authorizationToken()

            if (authToken) {
                return await authToken
            }

            authToken = await generateAuthToken()
            await db.saveAuthorizationToken(authToken)

            return authToken
        }

        this.push = async (deviceToken, headers, aps) => {
            const TOPIC = 'me.fin.bark'
            const APNS_HOST_NAME = 'api.push.apple.com'
            const AUTHENTICATION_TOKEN = await getAuthToken()

            return await fetch(`https://${APNS_HOST_NAME}/3/device/${deviceToken}`, {
                method: 'POST',
                headers: JSON.parse(JSON.stringify({
                    'apns-topic': headers['apns-topic'] || TOPIC,
                    'apns-id': headers['apns-id'] || undefined,
                    'apns-collapse-id': headers['apns-collapse-id'] || undefined,
                    'apns-priority': (headers['apns-priority'] > 0) ? headers['apns-priority'] : undefined,
                    'apns-expiration': headers['apns-expiration'] || util.getTimestamp() + 86400,
                    'apns-push-type': headers['apns-push-type'] || 'alert',
                    'authorization': `bearer ${AUTHENTICATION_TOKEN}`,
                    'content-type': 'application/json',
                })),
                body: JSON.stringify(aps),
            })
        }
    }
}

let cachedAuthToken = {}
let cachedDeviceToken = {}
let cachedMCPSession = {}

class Database {
    constructor(env) {
        const db = env.database

        db.exec('CREATE TABLE IF NOT EXISTS `devices` (`id` INTEGER PRIMARY KEY, `key` VARCHAR(255) NOT NULL, `token` VARCHAR(255) NOT NULL, `name` VARCHAR(255), `enabled` INTEGER DEFAULT 1, UNIQUE (`key`))')
        db.exec('CREATE TABLE IF NOT EXISTS `authorization` (`id` INTEGER PRIMARY KEY, `token` VARCHAR(255) NOT NULL, `time` VARCHAR(255) NOT NULL)')
        db.exec('CREATE TABLE IF NOT EXISTS `sessions` (`id` VARCHAR(64) PRIMARY KEY, `device_key` VARCHAR(255), `initialized` INTEGER DEFAULT 0, `created_at` INTEGER NOT NULL, `last_seen` INTEGER NOT NULL)')
        db.exec('CREATE TABLE IF NOT EXISTS `groups` (`id` INTEGER PRIMARY KEY, `name` VARCHAR(255) NOT NULL, `device_keys` TEXT NOT NULL)')

        this.countAll = async () => {
            const query = 'SELECT COUNT(*) as rowCount FROM `devices`'
            const result = await db.prepare(query).run()

            return (result.results[0] || { 'rowCount': -1 }).rowCount
        }

        this.deviceTokenByKey = async (key) => {
            const device_key = (key || '').replace(/[^a-zA-Z0-9]/g, '') || '_PLACE_HOLDER_'

            if (device_key && cachedDeviceToken[device_key]) {
                return cachedDeviceToken[device_key]
            }

            const query = 'SELECT `token`, `enabled` FROM `devices` WHERE `key` = ?'
            const result = await db.prepare(query).bind(device_key).run()

            if (result.results.length > 0) {
                const device = result.results[0]
                if (device.enabled === 0) {
                    return undefined
                }
                cachedDeviceToken[device_key] = device.token

                return device.token
            }
            
            return undefined
        }

        this.saveDeviceTokenByKey = async (key, token) => {
            const device_token = (token || '').replace(/[^a-z0-9]/g, '') || ''
            const query = 'INSERT INTO `devices` (`key`, `token`) VALUES (?, ?) ON CONFLICT(`key`) DO UPDATE SET `token` = EXCLUDED.`token`'
            const result = await db.prepare(query).bind(key, device_token).run()

            if (device_token === '') {
                delete cachedDeviceToken[key]
            } else {
                cachedDeviceToken[key] = device_token
            }

            return result
        }

        this.updateDevice = async (key, updates) => {
            const fields = []
            const values = []
            for (const [field, value] of Object.entries(updates)) {
                fields.push(`\`${field}\` = ?`)
                values.push(value)
            }
            if (fields.length === 0) return
            const query = `UPDATE \`devices\` SET ${fields.join(', ')} WHERE \`key\` = ?`
            return await db.prepare(query).bind(...values, key).run()
        }

        this.getAllDevices = async () => {
            const query = 'SELECT * FROM `devices`'
            const result = await db.prepare(query).run()
            return result.results
        }

        this.saveGroup = async (name, deviceKeys) => {
            const keysJson = JSON.stringify(deviceKeys)
            const query = 'INSERT INTO `groups` (`name`, `device_keys`) VALUES (?, ?) ON CONFLICT(`id`) DO UPDATE SET `name` = EXCLUDED.`name`, `device_keys` = EXCLUDED.`device_keys`'
            return await db.prepare(query).bind(name, keysJson).run()
        }

        this.getAllGroups = async () => {
            const query = 'SELECT * FROM `groups`'
            const result = await db.prepare(query).run()
            return result.results.map(g => ({ ...g, device_keys: JSON.parse(g.device_keys) }))
        }

        this.deleteGroup = async (id) => {
            const query = 'DELETE FROM `groups` WHERE `id` = ?'
            return await db.prepare(query).bind(id).run()
        }

        this.deleteDeviceByKey = async (key) => {
            const device_key = (key || '').replace(/[^a-zA-Z0-9]/g, '') || '_PLACE_HOLDER_'
            const query = 'DELETE FROM `devices` WHERE `key` = ?'
            const result = await db.prepare(query).bind(device_key).run()

            delete cachedDeviceToken[device_key]

            return result
        }

        this.saveAuthorizationToken = async (token) => {
            const timestamp = util.getTimestamp()
            const query = 'INSERT INTO `authorization` (`id`, `token`, `time`) VALUES (1, ?, ?) ON CONFLICT(`id`) DO UPDATE SET `token` = EXCLUDED.`token`,`time` = EXCLUDED.`time`'
            const result = await db.prepare(query).bind(token, timestamp).run()

            cachedAuthToken = {
                'token': token,
                'timestamp': timestamp,
            }

            return result
        }

        this.authorizationToken = async () => {
            if (cachedAuthToken && (util.getTimestamp() - cachedAuthToken.timestamp < 3000)) {
                return cachedAuthToken.token
            }

            const query = 'SELECT `token`, `time` FROM `authorization` WHERE `id` = 1'
            const result = await db.prepare(query).run()

            if (result.results.length > 0) {
                const tokenTime = parseInt(result.results[0].time)

                if (util.getTimestamp() - tokenTime <= 3000) {
                    cachedAuthToken = {
                        'token': result.results[0].token,
                        'timestamp': tokenTime,
                    }

                    return result.results[0].token
                }
            }

            return undefined
        }

        this.sessionBySessionID = async (sessionId) => {
            const timestamp = util.getTimestamp()

            if (sessionId && cachedMCPSession[sessionId]) {
                const session = cachedMCPSession[sessionId]
                if (session.last_seen > timestamp - 3600 && session.created_at > timestamp - 86400) {
                    return session
                } else {
                    delete cachedMCPSession[sessionId]
                }
            }

            const query = 'SELECT `id`, `device_key`, `initialized`, `created_at`, `last_seen` FROM `sessions` WHERE `id` = ? AND `last_seen` > ? AND `created_at` > ?'
            const result = await db.prepare(query).bind(sessionId, timestamp - 3600, timestamp - 86400).run()

            if (result.results.length > 0) {
                cachedMCPSession[sessionId] = result.results[0]

                return result.results[0]
            }

            return undefined
        }

        this.saveSessionBySessionID = async (sessionId, deviceKey, initialized, lastSeen) => {
            const timestamp = util.getTimestamp()
            const query = 'INSERT INTO `sessions` (`id`, `device_key`, `initialized`, `created_at`, `last_seen`) VALUES (?, ?, ?, ?, ?) ON CONFLICT(`id`) DO UPDATE SET `initialized` = EXCLUDED.`initialized`, `last_seen` = EXCLUDED.`last_seen`'
            const result = await db.prepare(query).bind(sessionId, deviceKey || null, initialized ? 1 : 0, timestamp, lastSeen ?? timestamp).run()

            if (cachedMCPSession[sessionId]) {
                cachedMCPSession[sessionId].initialized = initialized ? 1 : 0
                cachedMCPSession[sessionId].last_seen = lastSeen ?? timestamp
            } else {
                cachedMCPSession[sessionId] = {
                    id: sessionId,
                    device_key: deviceKey || null,
                    initialized: initialized ? 1 : 0,
                    created_at: timestamp,
                    last_seen: lastSeen ?? timestamp
                }
            }

            return result
        }

        this.deleteSessionBySessionID = async (sessionId) => {
            const query = 'DELETE FROM `sessions` WHERE `id` = ?'
            const result = await db.prepare(query).bind(sessionId).run()

            delete cachedMCPSession[sessionId]

            return result
        }

        this.cleanupExpiredSessions = async () => {
            const timestamp = util.getTimestamp()

            const query = 'DELETE FROM `sessions` WHERE `last_seen` < ? OR `created_at` < ?'
            const result = await db.prepare(query).bind(timestamp - 3600, timestamp - 86400).run()

            for (const id in cachedMCPSession) {
                const session = cachedMCPSession[id]
                if (session.last_seen < timestamp - 3600 || session.created_at < timestamp - 86400) {
                    delete cachedMCPSession[id]
                }
            }

            return result
        }
    }
}

class Util {
    constructor() {
        this.getTimestamp = () => {
            return Math.floor(Date.now() / 1000)
        }

        this.base64ToArrayBuffer = (base64) => {
            const binaryString = atob(base64)
            const length = binaryString.length
            const buffer = new Uint8Array(length)
            for (let i = 0; i < length; i++) {
                buffer[i] = binaryString.charCodeAt(i)
            }
            return buffer
        }

        this.newShortUUID = async () => {
            const uuid = crypto.randomUUID()
            const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(uuid))
            const hashArray = Array.from(new Uint8Array(hashBuffer))

            return btoa(String.fromCharCode(...hashArray)).replace(/[^a-zA-Z0-9]|[lIO01]/g, '').slice(0, 22)
        }

        this.newMCPSessionUUID = async () => {
            const uuid = crypto.randomUUID()
            
            return `mcp-session-${uuid}`
        }

        const constantTimeCompare = (a, b) => {
            if (typeof a !== 'string' || typeof b !== 'string') { return false }
            if (a.length !== b.length) { return false }
            let result = 0
            for (let i = 0; i < a.length; i++) {
                result |= a.charCodeAt(i) ^ b.charCodeAt(i)
            }
            return result === 0
        }

        this.validateBasicAuth = (request, basicAuth) => {
            if (basicAuth) {
                const authHeader = request.headers.get('Authorization')
                if (typeof authHeader !== 'string' || !authHeader.startsWith('Basic ')) { return false }
                const received = authHeader.slice(6) // Remove 'Basic ' prefix
                const expected = btoa(`${basicAuth}`)
                return constantTimeCompare(received, expected)
            }
            return true
        }
    }
}

const util = new Util()

async function getAdminHtml() {
    // In a production environment, this could be stored in KV or a separate file.
    // For the purpose of this implementation, we are returning the content of admin.html
    // since we've created it in the workspace.
    // NOTE: In a real Cloudflare Worker environment, you cannot read local files at runtime.
    // We'll assume the content of admin.html is bundled or provided as a string.
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bark-Worker Admin</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; max-width: 800px; margin: 0 auto; padding: 20px; background: #f4f4f9; color: #333; }
        h1, h2 { color: #2c3e50; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; }
        input[type="text"], input[type="number"], select { padding: 8px; border: 1px solid #ccc; border-radius: 4px; width: 100%; box-sizing: border-box; }
        button { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; background: #3498db; color: white; font-weight: bold; }
        button:hover { background: #2980b9; }
        button.danger { background: #e74c3c; }
        button.danger:hover { background: #c0392b; }
        .flex { display: flex; gap: 10px; align-items: center; }
        .status-badge { padding: 2px 8px; border-radius: 12px; font-size: 0.8em; }
        .status-on { background: #d4edda; color: #155724; }
        .status-off { background: #f8d7da; color: #721c24; }
        .hidden { display: none; }
        .group-item { display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee; }
    </style>
</head>
<body>
    <h1 style="color: #2980b9;">Bark-Worker Admin v1.0</h1>
    
    <div class="card">
        <h2>Server Settings</h2>
        <div id="settings-info">Loading settings...</div>
        <p><small>Note: Settings are primarily managed via Cloudflare Environment Variables.</small></p>
    </div>

    <div class="card">
        <h2>Devices</h2>
        <table id="devices-table">
            <thead>
                <tr>
                    <th>Key</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </div>

    <div class="card">
        <h2>Device Groups</h2>
        <div id="groups-list"></div>
        <hr>
        <h3>Create New Group</h3>
        <div class="flex" style="flex-direction: column; align-items: flex-start;">
            <input type="text" id="group-name" placeholder="Group Name" style="margin-bottom: 10px;">
            <div id="device-selector" style="margin-bottom: 10px; max-height: 150px; overflow-y: auto; border: 1px solid #ccc; padding: 10px; width: 100%; box-sizing: border-box;">
                <!-- Checkboxes will be injected here -->
            </div>
            <button onclick="createGroup()">Create Group</button>
        </div>
    </div>

    <script>
        const API_BASE = '/admin';

        async function fetchAPI(endpoint, method = 'GET', body = null) {
            const options = { method, headers: { 'Content-Type': 'application/json' } };
            if (body) options.body = JSON.stringify(body);
            const res = await fetch(\`\${API_BASE}\${endpoint}\`, options);
            return res.json();
        }

        async function loadDevices() {
            const devices = await fetchAPI('/devices');
            const tbody = document.querySelector('#devices-table tbody');
            const selector = document.getElementById('device-selector');
            tbody.innerHTML = '';
            selector.innerHTML = '';

            devices.forEach(d => {
                const row = document.createElement('tr');
                row.innerHTML = \`
                    <td><code style="background: #eee; padding: 2px 4px; border-radius: 3px;">\${d.key}</code></td>
                    <td><input type="text" value="\${d.name || ''}" onchange="updateDevice('\${d.key}', this.value)"></td>
                    <td><span class="status-badge \${d.enabled ? 'status-on' : 'status-off'}">\${d.enabled ? 'Enabled' : 'Disabled'}</span></td>
                    <td><button onclick="toggleDevice('\${d.key}', \${d.enabled})">\${d.enabled ? 'Disable' : 'Enable'}</button></td>
                \`;
                tbody.appendChild(row);

                const label = document.createElement('label');
                label.style.display = 'block';
                label.innerHTML = \`<input type="checkbox" value="\${d.key}" class="device-checkbox"> \${d.name || d.key}\`;
                selector.appendChild(label);
            });
        }

        async function updateDevice(key, name) {
            await fetchAPI('/devices', 'POST', { key, updates: { name } });
        }

        async function toggleDevice(key, currentStatus) {
            await fetchAPI('/devices', 'POST', { key, updates: { enabled: currentStatus ? 0 : 1 } });
            loadDevices();
            loadGroups();
        }

        async function loadGroups() {
            const groups = await fetchAPI('/groups');
            const container = document.getElementById('groups-list');
            container.innerHTML = '';

            groups.forEach(g => {
                const div = document.createElement('div');
                div.className = 'group-item';
                div.innerHTML = \`
                    <div>
                        <strong>\${g.name}</strong> 
                        <small>(\${g.device_keys.length} devices)</small>
                    </div>
                    <button class="danger" onclick="deleteGroup(\${g.id})">Delete</button>
                \`;
                container.appendChild(div);
            });
        }

        async function createGroup() {
            const name = document.getElementById('group-name').value;
            const checkboxes = document.querySelectorAll('.device-checkbox:checked');
            const device_keys = Array.from(checkboxes).map(cb => cb.value);

            if (!name || device_keys.length === 0) {
                alert('Please provide a group name and select at least one device.');
                return;
            }

            await fetchAPI('/groups', 'POST', { name, device_keys });
            document.getElementById('group-name').value = '';
            loadGroups();
        }

        async function deleteGroup(id) {
            if (confirm('Delete this group?')) {
                await fetchAPI('/groups/delete', 'POST', { id });
                loadGroups();
            }
        }

        async function loadSettings() {
            const settings = await fetchAPI('/settings');
            document.getElementById('settings-info').innerHTML = \`
                <ul>
                    <li>Allow Registration: <strong>\${settings.allowNewDevice ? 'Yes' : 'No'}</strong></li>
                    <li>Allow Query Numbers: <strong>\${settings.allowQueryNums ? 'Yes' : 'No'}</strong></li>
                </ul>
            \`;
        }

        async function init() {
            await loadSettings();
            await loadDevices();
            await loadGroups();
        }

        init();
    </script>
</body>
</html>
`;
}
