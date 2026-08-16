import { NextRequest, NextResponse } from 'next/server'
import { getTenantForHost } from '@/lib/get-tenant'

export async function GET(request: NextRequest) {
  const config = await getTenantForHost(request.headers.get('host'))
  return NextResponse.json(config)
}
