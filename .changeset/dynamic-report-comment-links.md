---
'@accounter/client': minor
---

Links in dynamic-report comments are now clickable: an `http://` or `https://` URL in a message
opens in a new tab. Comments are still shown as plain text: other schemes such as `javascript:` stay
text, and punctuation or a closing bracket right after a URL is not part of the link. The
last-message preview in the discussions list stays plain text, since clicking it already opens the
thread.
