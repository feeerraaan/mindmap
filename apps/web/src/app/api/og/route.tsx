import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title') ?? 'MindMap'
  const subtitle = searchParams.get('subtitle') ?? 'An MRI scan for knowledge.'

  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        padding: '60px 80px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: '#0066cc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: '24px',
            fontWeight: '600',
            fontFamily: 'sans-serif',
          }}
        >
          M
        </div>
        <span
          style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#1d1d1f',
            fontFamily: 'sans-serif',
          }}
        >
          MindMap
        </span>
      </div>
      <div
        style={{
          fontSize: '56px',
          fontWeight: '600',
          color: '#1d1d1f',
          lineHeight: 1.07,
          letterSpacing: '-0.28px',
          marginBottom: '24px',
          fontFamily: 'sans-serif',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: '24px',
          color: '#6e6e73',
          lineHeight: 1.4,
          fontFamily: 'sans-serif',
        }}
      >
        {subtitle}
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  )
}
