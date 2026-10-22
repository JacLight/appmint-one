/// Device layouts select tools; staff permissions still control access.
class DevicePreset {
  final String id;
  final String title;
  final String description;
  final Set<String> items;
  const DevicePreset(this.id, this.title, this.description, this.items);
}

const eventDevicePresets = [
  DevicePreset(
    'event_all',
    'Event operations',
    'Accreditations, ticket sales, scanning and venue management.',
    {
      'events',
      'badge',
      'tickets',
      'scan',
      'stats',
      'schedule',
      'people',
      'info',
      'manage',
      'devices',
    },
  ),
  DevicePreset(
    'event_accreditation',
    'Accreditations',
    'Find registrations, fulfill ticket pickup and register walk-ins.',
    {'events', 'badge', 'people', 'devices'},
  ),
  DevicePreset(
    'event_ticket_sales',
    'Ticket sales',
    'Ticket desk, ticket types and attendee lookup.',
    {'events', 'tickets', 'people', 'devices'},
  ),
  DevicePreset(
    'event_scanning',
    'Scanning',
    'Check tickets in and out at the event’s access points.',
    {'events', 'scan', 'info', 'devices'},
  ),
  DevicePreset(
    'event_venue',
    'Venue management',
    'Monitor zones, occupancy, schedules and event activity.',
    {'events', 'stats', 'schedule', 'info', 'people', 'manage', 'devices'},
  ),
];

/// Layouts for the standard Home (not an event or restaurant home): the
/// layout picks its apps, the dashboard is the usual one.
const crmDevicePresets = [
  DevicePreset(
    'crm_field_sales',
    'Field sales',
    'Leads and their pipeline, calls and texts, contacts and follow-up tasks.',
    {'phone', 'sms', 'inbox', 'leads', 'contacts', 'tasks'},
  ),
  DevicePreset(
    'crm_team_manager',
    'Team manager',
    'Approvals, the team workspace, AI employees and the team\u2019s tasks, with the inbox and calls.',
    {'approvals', 'workspaces', 'ai_employees', 'tasks', 'inbox', 'phone', 'sms', 'contacts'},
  ),
  DevicePreset(
    'crm_customer_support',
    'Customer support',
    'Live chat and who is on the website, the inbox, calls and texts, and support tickets.',
    {'live_chat', 'inbox', 'sms', 'phone', 'support', 'contacts'},
  ),
];
