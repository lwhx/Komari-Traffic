import { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import './AppLayout.css'

/**
 * 导航菜单项定义
 * @property path - 路由路径
 * @property icon - 菜单图标（Unicode 字符）
 * @property label - 菜单文字
 */
const navItems = [
  { path: '/', icon: '◎', label: '仪表盘' },
  { path: '/realtime', icon: '⚡', label: '实时监控' },
  { path: '/analysis', icon: '📈', label: '流量分析' },
  { path: '/compare', icon: '⚖️', label: '节点对比' },
  { path: '/map', icon: '🌍', label: '区域分布' },
  { path: '/manage', icon: '📋', label: '节点管理' },
  { path: '/export', icon: '📤', label: '数据导出' },
]

/**
 * 应用主布局组件
 * 包含顶部导航栏和侧边栏，通过 Outlet 渲染子路由内容
 */
export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('komari-theme')
    if (stored === 'dark' || stored === 'light') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const location = useLocation()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('komari-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(t => t === 'light' ? 'dark' : 'light')
  }

  /**
   * 获取当前页面的标题
   * @returns 当前匹配的导航项标题
   */
  const currentPage = navItems.find(item => {
    if (item.path === '/') return location.pathname === '/'
    return location.pathname.startsWith(item.path)
  })

  return (
    <div className={`app-layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <header className="layout-header">
        <div className="header-left">
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            ☰
          </button>
          <h1 className="layout-logo">
            <span className="logo-icon">◎</span>
            {!collapsed && <span className="logo-text">Komari Traffic</span>}
          </h1>
        </div>
        <div className="header-right">
          <span className="page-title">{currentPage?.label ?? '仪表盘'}</span>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === 'light' ? '切换暗色模式' : '切换亮色模式'}
          >
            {theme === 'light' ? '☾' : '☀'}
          </button>
        </div>
      </header>

      <aside className="layout-sidebar">
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && <span className="nav-label">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="layout-content">
        <Outlet />
      </main>
    </div>
  )
}
