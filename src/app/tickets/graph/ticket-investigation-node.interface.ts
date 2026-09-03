import type { Runtime } from '@langchain/langgraph';

import type { TicketInvestigationGraphState } from './ticket-investigation.state';

export interface ITicketInvestigationNode {
  run(state: TicketInvestigationGraphState, runtime: Runtime): Promise<Partial<TicketInvestigationGraphState>>;
}
