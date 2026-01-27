---
'@accounter/server': patch
---

- **Enhanced Reliability with Auto-Restart**: Implemented an automatic restart mechanism for the
  Gmail Pub/Sub listener. Upon encountering subscription errors or health check failures, the
  listener will now attempt to stop and restart itself, improving resilience and ensuring continuous
  operation.
- **Comprehensive Health Monitoring**: Introduced a periodic health check system that runs every 10
  minutes. This system verifies the listener's active state, tracks message reception, and confirms
  Gmail API connectivity. If any check fails, an auto-restart is triggered to restore service.
- **Extensive and Structured Logging**: Significantly improved logging across the Pub/Sub service.
  Log messages now include clear prefixes (e.g., "[PubSub]", "[Gmail]", "[PubSub Health]") and
  provide more detailed information on topic/subscription creation, message processing, error
  handling, and Gmail watch renewals, aiding in debugging and operational visibility.
- **Improved Error Handling for Message Processing**: Modified the message processing logic to
  acknowledge messages even if an error occurs during their handling. This prevents messages from
  being infinitely redelivered and allows for better error recovery strategies.
- **Robust Topic and Subscription Management**: Updated the logic for validating and creating
  Pub/Sub topics and subscriptions to explicitly check for their existence using the `exists()`
  method and provide more informative logging during creation or error scenarios.
