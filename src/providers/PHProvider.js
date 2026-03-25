'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProviderReact } from 'posthog-js/react'
import { useUser } from '@clerk/nextjs'
import { useEffect } from 'react'

// ブラウザ環境かつAPIキーが設定されている場合のみ初期化
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false // SPAでの二重計測を防ぐため必要に応じてOFFにするが、Next.js App Routerでは標準で問題ない場合が多い。
  })
}

export function PHProvider({ children }) {
  const { user, isLoaded, isSignedIn } = useUser()

  useEffect(() => {
    // ユーザー情報がロードされ、ログイン状態であればIdentifyする
    if (isLoaded && isSignedIn && user) {
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName || user.username
      });
    } else if (isLoaded && !isSignedIn) {
      // ログアウト時はリセット
      posthog.reset();
    }
  }, [user, isLoaded, isSignedIn])

  return <PHProviderReact client={posthog}>{children}</PHProviderReact>
}
