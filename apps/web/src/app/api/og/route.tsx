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
        <img
          src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAFGElEQVR4nO2Ya2wUVRTH/+fO7G4ftLu1FLpFHn1AaZtWkpZKArKlWlGREhLbSIIvEIwKRowY+WCWDVoVH0GjIL6Q6Be3GAENoRBsC5JgpAEk2NC0BKxYhLa03W73MXPn+KEPK/UD3V2iH+b3ae49mXvOvfec/70zgImJiYmJSQzxghW3i9Ub+6u8rMDLyn8R0/8aitVADKbNaFByZy54JaDA3uPo2PTCialBAjBvA+L8KfobvmTuvJixtwZVVQaIOBZ+o54AgwUA2gxwQdaFJEPN6lHjgDbRN2tgWXKb51fQoum9M7qn2luvWoGwszO569REPwpAqAKDyIh+GjFkd86Aa0decNmN/bmvBpdOeTdQ/l/E9K8MrTxOZAeebc7Vjxyf1Td7tH3tg5cTHnpM+7psg7Yr570W22ib9ctgvtqg14sj4acBIJriHqMWN8vHgMJgPgFtuVNVyq8G1Tvc4JaCebCd6zsnO4XDoVrUaj0esGvpG4t3stGUAhXnEGJbuFBOUcrQbuhg/ghNEABkpLFERV1Wx6QfcwL3euEds4pLVvtLy9f5S8e85GahHNIW4/v+9Gj9j7uIGUy1qBX2nModgkW2kWipXPwL+d1gkTc7nG9TlM/ahbGn66zlHQ+GCtTNIjNJe75ztvKwL1FfizLrGRAxdnEcphn7yYYO1o6uRlmZHK86ifEGDwDIz1cMg5bEC0t50N/rBAAPyHAY4tHJFqVUQjzuARkMJjALeMgQUnlEThNzFVVdNRKkI5AGm6hg5geAGYPpzDyuRY1oBwjE+6Z1ZBoUZ19+KeX0qenXHXHJSdUBKfPOs2josoaz2KK0Hc3s/SENQHOafWH3RBS0zFVak1NRLFT6raPX/w0q7F04HCoEDD8q4i+AmWJ1Ptw0Tdna9su5svN0rvbm6P4t8/1PrVwpf79rk2xf+FzgmdG2xANaDf0ku3FU7orW/7hSaDSMQemTRBkgkWqw7AcG70IMpvOZxrf9CTQlkCRub53D34GZsJMtAMAG+6GKFICdAKKS0UhOYgLAAOhATos1XrNQstWZaYlDJUjoZy3B3Zasg9era6tl+YuhIp9Vt/5ck3gSAAq396T0lkx4UgcSroXkHm2g+yKkT8f9M8ODqcME3OIUcg8dYPU54b2NOfLPuizfpGFbQ17o9b1FMrh1Tvhz4J/FOLMmtM1+UPodx+TWkU4v30ZH5BU6ru8bHJzHnRERp5DBuC7BPRyWOjBY3K1G8Auf5B4YpI1ZSUKQg+jt6dM+HVGaEHRI9MDgvkjjiJq6oo7Eumx/8XB7rfNkwvBz5apg7n3rA9nD7Zz1f18p4mv9JfB226P1H/FVoh6sLgLp7E/9JMNmWbEn21d+tm1C49IMaPcsYOV4uCepndXmzgQaKHqrY3JKf3qoEWAwk/PDwHyfM/6Y6LPtN4BlqGcVi0iPJI6IU+gawABTmOXhP3StbkDRL3pARkkTadW1JB1WxwCz8ZUIG7UpJemhRg/p8FAYREyES8oVeUiEjUMAE64h4sKN2QcNAOwsvpxgC6Vt7Fe4ed0Zm3e0rfTl0IreVCU7OFF5+9ITFIyVz4h3YBgGi5NgC4MpwZdY4LRZNoehvO92s3C5WK3ysuJyuVVI8YFwKlsCev+skTOBx686twoCmOpdrO7ID63ZVqjdDQxJ7pA03vlSoCL/tdAa1LN6o8SaxBK3i1Uvxl4NqqpYcbnH/m4xMTExMTExMTExMTGJlL8AaDMzhNpDxyYAAAAASUVORK5CYII="
          width={48}
          height={48}
          style={{ borderRadius: '12px' }}
          alt=""
        />
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
