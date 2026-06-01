import { NavLink } from 'react-router-dom';

const tabs = [
  { label: 'Users', to: '/users' },
  { label: 'Orgs', to: '/orgs' },
  { label: 'Projects', to: '/projects' },
  { label: 'Searches', to: '/searches' },
];

export default function TabBar() {
  return (
    <nav className="flex border-b border-gray-200 bg-white px-4">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
              isActive
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
