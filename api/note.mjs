import { handleCoach } from '../server/coach-core.mjs';
export default { fetch: request => handleCoach(request, 'note') };
