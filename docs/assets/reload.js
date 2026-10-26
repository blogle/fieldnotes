// Injected by the development server; standalone HTML has no server dependency.
const events = new EventSource('/__fieldnotes/events');
events.onmessage = () => location.reload();
