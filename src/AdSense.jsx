import { useEffect, useRef } from 'react'

const publisherId = import.meta.env?.VITE_ADSENSE_PUBLISHER_ID || ''
const validPublisherId = /^ca-pub-\d+$/.test(publisherId)

export function AdSenseLoader() {
  useEffect(() => {
    if (!validPublisherId || document.querySelector('script[data-taskrupt-adsense]')) return

    const script = document.createElement('script')
    script.async = true
    script.crossOrigin = 'anonymous'
    script.dataset.taskruptAdsense = 'true'
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`
    document.head.appendChild(script)
  }, [])

  return null
}

export function AdSenseSlot({ slot }) {
  const slotRef = useRef(null)
  const requested = useRef(false)

  useEffect(() => {
    if (!validPublisherId || !slot || requested.current || !slotRef.current) return
    try {
      window.adsbygoogle = window.adsbygoogle || []
      window.adsbygoogle.push({})
      requested.current = true
    } catch (error) {
      // AdSense can decline to fill a slot while the site is under review or has no available ad.
      console.warn('AdSense slot could not be initialized.', error)
    }
  }, [slot])

  if (!validPublisherId || !slot) return null

  return (
    <aside className="adsense-placement" aria-label="Advertisement">
      <span className="adsense-label">Advertisement</span>
      <ins
        ref={slotRef}
        className="adsbygoogle"
        style={{ display: 'block', minHeight: 100 }}
        data-ad-client={publisherId}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  )
}
