import React from 'react'

/**
 * WCD Dashboard Header — Light Theme
 */
export default function Header({ pageSubtitle = 'Viksit Gujarat Vision @2047' }) {
  return (
    <header className="wcd-header">
      {/* Left — Map icon & GRIT Badge */}
      <div className="wcd-header__left">
        <img
          src="/indiamap.png"
          alt="GRIT Logo"
          style={{ height: 50, width: 'auto', borderRadius: 4, objectFit: 'contain' }}
        />

        {/* <img
          src="/gritlogo.jpg"
          alt="GRIT Logo"
          style={{ height: 50, width: 'auto', borderRadius: 4, objectFit: 'contain' }}
        /> */}
      </div>

      {/* Center — Titles */}
      <div className="wcd-header__title-block">
        <div className="wcd-header__title">
          Viksit  Rajya  Institution  For  Transformation
        </div>
        <div className="wcd-header__subtitle">
          Women &amp; Child Development Department
        </div>
        <div className="wcd-header__page-subtitle">
          Infra, Digital Platforms &amp; Women Empowerment
        </div>
      </div>

      {/* Right — Profile/Institution badge */}
      <div className="wcd-header__profile">
        <img
          src="/vikistrajyalogo.png"
          alt="GRIT Logo"
          style={{ height: 50, width: 'auto', borderRadius: 4, objectFit: 'contain' }}
        />
      </div>
    </header>
  )
}
