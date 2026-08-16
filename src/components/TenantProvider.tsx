'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { DEFAULT_TENANT, TenantConfig, deriveBrandTokens } from '@/lib/tenant'

interface TenantContextType {
  tenant: TenantConfig
  isLoading: boolean
}

const TenantContext = createContext<TenantContextType>({
  tenant: DEFAULT_TENANT,
  isLoading: false,
})

export function TenantProvider({
  children,
  initialTenant,
}: {
  children: React.ReactNode
  initialTenant?: TenantConfig
}) {
  const [tenant] = useState<TenantConfig>(initialTenant || DEFAULT_TENANT)
  const [isLoading] = useState<boolean>(false)

  useEffect(() => {
    if (!tenant?.branding?.primaryColor) return
    const root = document.documentElement
    const tokens = deriveBrandTokens(tenant.branding)
    for (const [name, value] of Object.entries(tokens)) {
      root.style.setProperty(name, value)
    }
  }, [tenant])

  return (
    <TenantContext.Provider value={{ tenant, isLoading }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant deve ser usado dentro de um TenantProvider')
  }
  return context
}
