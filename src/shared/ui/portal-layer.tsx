/* eslint-disable react-refresh/only-export-components */
'use client';

import * as React from 'react';

type PortalLayer = 'default' | 'modal';

const PortalLayerContext = React.createContext<PortalLayer>('default');

function PortalLayerProvider({ children, layer }: React.PropsWithChildren<{ layer: PortalLayer }>) {
  return <PortalLayerContext.Provider value={layer}>{children}</PortalLayerContext.Provider>;
}

function usePortalLayer() {
  return React.useContext(PortalLayerContext);
}

export { PortalLayerProvider, usePortalLayer };
