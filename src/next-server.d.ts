// Fix para erro de tipo auto-gerado pelo Next.js 15
// "Could not find a declaration file for module 'next/server.js'"
declare module 'next/server.js' {
  export { NextRequest, NextResponse } from 'next/server';
  export type { NextRequest, NextResponse } from 'next/server';
}
