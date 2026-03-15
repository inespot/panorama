import type { Connector } from '@panorama/shared';

const connectors = new Map<string, Connector>();

/** Registers a connector so the sync engine and API can discover it. */
export function registerConnector(connector: Connector): void {
  connectors.set(connector.id, connector);
}

/** Returns a connector by its unique id, or undefined if not registered. */
export function getConnectorById(id: string): Connector | undefined {
  return connectors.get(id);
}

/** Returns all registered connectors. */
export function getAllConnectors(): Connector[] {
  return Array.from(connectors.values());
}
