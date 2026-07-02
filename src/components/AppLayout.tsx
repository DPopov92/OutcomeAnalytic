import { NavLink, Outlet } from 'react-router-dom'
import { AppLogoIcon } from '../assets/icons/AppLogoIcon'
import './AppLayout.css'

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-nav">
        <div className="app-nav-inner">
          <NavLink to="/" className="app-brand" end>
            <AppLogoIcon className="app-brand-icon" size={28} strokeWidth={2} />
            <span className="app-brand-text">Outcome Analytic</span>
          </NavLink>

          <nav className="app-nav-links" aria-label="Основная навигация">
            <NavLink to="/" className="app-nav-link" end>
              Главная
            </NavLink>
            <NavLink to="/categories" className="app-nav-link">
              По категориям
            </NavLink>
          </nav>
        </div>
      </header>

      <div className="app-content">
        <Outlet />
      </div>
    </div>
  )
}
