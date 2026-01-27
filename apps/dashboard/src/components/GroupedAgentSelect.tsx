/**
 * @fileoverview Grouped Agent Select Component
 * @module @vorion/dashboard/components/GroupedAgentSelect
 *
 * A select dropdown that groups agents by Vorion module (Bootstrap, Core, Factory, Forge, Labs)
 * with icons for extended agents.
 */

import { AGENT_OPTIONS, getAgentIcon, type AgentModule } from '../lib/agents';

interface GroupedAgentSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  showIcons?: boolean;
  placeholder?: string;
}

interface AgentOptionGroup {
  label: string;
  options: Array<{ value: string; label: string; icon?: string }>;
}

// Group options by their group property
function getGroupedOptions(): AgentOptionGroup[] {
  const groups: Record<string, AgentOptionGroup> = {};

  for (const option of AGENT_OPTIONS) {
    if (!option.value) continue; // Skip "All Agents"

    const groupKey = (option as any).group || 'Other';
    if (!groups[groupKey]) {
      groups[groupKey] = { label: groupKey, options: [] };
    }
    groups[groupKey].options.push({
      value: option.value,
      label: option.label,
      icon: getAgentIcon(option.value),
    });
  }

  // Order groups by Vorion module hierarchy
  const order = ['Bootstrap', 'Core', 'Factory', 'Forge', 'Labs', 'Ops', 'Security', 'Data'];
  return order
    .filter((key): key is string => key in groups)
    .map((key) => groups[key]!);
}

export function GroupedAgentSelect({
  value,
  onChange,
  className = '',
  showIcons = true,
  placeholder = 'All Agents',
}: GroupedAgentSelectProps) {
  const groupedOptions = getGroupedOptions();

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 ${className}`}
    >
      <option value="" className="bg-[#0a0a0a]">
        {placeholder}
      </option>

      {groupedOptions.map((group) => (
        <optgroup key={group.label} label={group.label} className="bg-[#0a0a0a]">
          {group.options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="bg-[#0a0a0a]"
            >
              {showIcons && option.icon ? `${option.icon} ` : ''}
              {option.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/**
 * Simple flat agent select (no grouping)
 */
export function AgentSelect({
  value,
  onChange,
  className = '',
  showIcons = true,
  placeholder = 'All Agents',
  module,
}: GroupedAgentSelectProps & { module?: AgentModule }) {
  let options = AGENT_OPTIONS;

  // Filter by module if specified
  if (module === 'bootstrap') {
    options = options.filter(
      (o) => !o.value || (o as any).group === 'Bootstrap'
    );
  } else if (module) {
    // Core, Factory, Forge, Labs
    const moduleLabel = module.charAt(0).toUpperCase() + module.slice(1);
    options = options.filter(
      (o) => !o.value || (o as any).group === moduleLabel
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 ${className}`}
    >
      <option value="" className="bg-[#0a0a0a]">
        {placeholder}
      </option>
      {options
        .filter((o) => o.value)
        .map((option) => {
          const icon = getAgentIcon(option.value);
          return (
            <option
              key={option.value}
              value={option.value}
              className="bg-[#0a0a0a]"
            >
              {showIcons && icon ? `${icon} ` : ''}
              {option.label}
            </option>
          );
        })}
    </select>
  );
}

export default GroupedAgentSelect;
