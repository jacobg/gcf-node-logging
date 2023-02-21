import functions from '@google-cloud/functions-framework'
import { Logging } from '@google-cloud/logging'

const functionName = 'gcf-node-logging'

functions.http(functionName, async (req, res) => {
  const requestStartMs = Date.now()

  console.log(JSON.stringify({
    severity: 'INFO',
    message: 'info message'
  }))

  console.log(JSON.stringify({
    severity: 'WARNING',
    message: 'warning message'
  }))

  // Create a request log.

  const host = req.header('host')
  const match = /([\w-]+-[\w-]+)-([\w-]+)\.cloudfunctions\.net/.exec(host)
  const region = match[1]
  const projectId = match[2]
  const url = `${req.protocol}://${req.hostname}/${functionName}${req.originalUrl}`

  const traceHeader = req.header('X-Cloud-Trace-Context')
  const [trace] = traceHeader ? traceHeader.split('/') : []

  const requestSize = req.header('content-length')
  // TODO: We don't know the response size until we send it.
  // TOOD: We might need a custom send function to pass in the data so we can calculate its size.
  // TODO: Then after creating this request log, we would actually call the real res.send function.
  const responseSize = (res.getHeader && Number(res.getHeader('Content-Length'))) || 0

  const latencyMs = Date.now() - requestStartMs

  const logging = new Logging({ projectId })
  const requestLog = logging.log('cloudfunctions.googleapis.com%2Frequest_log')

  const logEntry = requestLog.entry({
    severity: 'INFO',
    textPayload: 'request log message',
    timestamp: new Date().toISOString(),
    // It seems GCF automatically adds trace, resource, and labels.
    trace: `projects/${projectId}/traces/${trace}`,
    resource: {
      type: 'cloud_function',
      labels: {
        function_name: functionName,
        project_id: projectId,
        region
      }
    },
    labels: {
      execution_id: req.header('Function-Execution-Id')
    },
    httpRequest: Object.assign(
      {
        requestMethod: req.method,
        requestUrl: url,
        protocol: req.protocol,
        status: res.statusCode,
        userAgent: req.header('user-agent'),
        latency: `${latencyMs / 1000}s`,
        remoteIp: req.ip,
        referer: req.header('referer')
      },
      requestSize ? { requestSize } : null,
      responseSize ? { responseSize } : null
    )
  })
  await requestLog.write(logEntry)

  res.sendStatus(200)
  res.end()
})
