import type { Dict } from './types';

export const en: Dict = {
  // Language toggle
  'language.toggle': 'Language',
  'language.en': 'English',
  'language.ko': 'Korean',

  // Analytics — action buttons on insight cards
  'analytics.action.editZone': 'Edit zone',
  'analytics.action.editCapacity': 'Edit capacity',
  'analytics.action.editMedia': 'Edit media',
  'analytics.action.viewHeatmap': 'View heatmap',
  'analytics.action.viewFlow': 'View flow',
  'analytics.action.checkZone': 'Check zone',
  'analytics.action.viewDensity': 'View density',

  // Analytics — static pre-sim insight (congestion warning)
  'analytics.staticInsight.title': '{zone}: Pre-expand area recommended',
  'analytics.staticInsight.cause':
    'Est. density {density}m²/person < threshold 2.5m²/person — bottleneck risk {risk}',
  'analytics.staticInsight.rec':
    '→ Raise capacity cap or expand area in advance',

  // Zone Media Performance
  'zoneMedia.itemsSuffix': 'items',

  // Flow vs Experience
  'flowVsExperience.rushThrough':
    'rush-through: watch depth under 25% vs installed media',

  // Completion Report
  'report.perPerson': 'per person',

  // Simulation — validation toasts
  'sim.toast.entryNeeded': 'ENTRY node required',
  'sim.toast.exitNeeded': 'EXIT node required',
  'sim.toast.edgeNeeded': 'At least 1 edge required',
  'sim.toast.nodesAndEdgesNeeded': 'Place nodes and edges',

  // Simulation — stop dialog
  'sim.stop.title': 'Stop Simulation',
  'sim.stop.body':
    'All agents, media stats, KPI history, and replay frames will be cleared.\nThis action cannot be undone.',
  'sim.stop.cancel': 'Cancel',
  'sim.stop.confirm': 'Reset',

  // Build — waypoint node descriptions (tooltips)
  'build.node.entry.desc': 'Spawn point',
  'build.node.exit.desc': 'Exit point',
  'build.node.zone.desc': 'Exhibition stop',
  'build.node.attractor.desc': 'High-attraction target',
  'build.node.hub.desc': 'Junction / branch',
  'build.node.rest.desc': 'Rest / buffer',

  // Build — hints
  'build.hint.placeNode': 'Click canvas to place node',
  'build.hint.edgeMode.title': 'Edge connection mode',
  'build.hint.edgeMode.body':
    'Click first node → click second node to connect',
  'build.hint.zoneArea':
    'Zone = media placement area. Use Node/Edge for flow.',

  // Zone / Media editor — polygon shape
  'editor.shape.done': '✓ Shape done',
  'editor.shape.edit': 'Edit shape',

  // Waypoint inspector
  'waypoint.namePlaceholder': 'Node name',

  // Project manager
  'project.toast.saved': '"{name}" v{version} saved',
  'project.toast.invalid': 'Invalid project file',
  'project.toast.opened': '"{name}" opened',
  'project.toast.parseError': 'File parse error',
  'project.openTitle': 'Open JSON file',

  // Zone templates
  'zoneTemplate.linear.desc': 'Linear flow (entrance → exhibits → exit)',
  'zoneTemplate.hub.desc': 'Central hall + satellite exhibits',
  'zoneTemplate.grid.desc': 'Grid of booths',
  'zoneTemplate.hall.desc': 'Single large exhibition hall',

  // Scenario compare
  'scenario.compare.recommend': 'Recommend',
  'scenario.compare.scenarioPrefix': 'Scenario',
  'scenario.compare.equal': 'tie',

  // Config fields
  'configFields.sumRequired': 'Sum: {total}% (100% required)',

  // Welcome screen
  'welcome.error.invalidFile':
    'Invalid file (missing meta / zones / simulationConfig)',
  'welcome.error.parseError': 'Parse error: {message}',
  'welcome.error.jsonOnly': 'Only .json files are supported',
  'welcome.drop.hint': 'Drop JSON file here',
  'welcome.drag.hint': 'Or drag a .json file to open',
  'welcome.projectName': 'Project name',

  // Property popover
  'popover.waypoint.namePlaceholder': 'Name',
  'popover.capacity.autoCalc': 'Auto-calculated by area: {count}',
  'popover.media.outOfSpace':
    'Not enough space. Please expand the zone or move existing media.',

  // Visitor popover
  'visitor.state.idle': 'Idle',
  'visitor.state.moving': 'Moving',
  'visitor.state.watching': 'Watching',
  'visitor.state.waiting': 'Waiting',
  'visitor.state.exiting': 'Exiting',

  // Context menu
  'context.delete': 'Delete',
  'context.duplicate': 'Duplicate',
  'context.edit': 'Edit',

  // Main layout — zone list
  'mainLayout.dragHandle': 'Drag to reorder',

  // Sensitivity panel — dynamic recommendations
  'sensitivity.rec.expandEntrance':
    'Expanding capacity to {capacity} projected to reduce bottleneck by {percent}%',
  'sensitivity.rec.reduceInflow':
    'Reducing inflow rate to {rate}/s projected to improve overall density by 30%',
  'sensitivity.rec.addExhibitionZone':
    'Adding 1 exhibition zone projected to reduce overloaded zones from {before} to {after}',
  'sensitivity.rec.expandRest':
    'Expanding rest area by 50% projected to reduce avg fatigue from {before}% to {after}%',
  'sensitivity.rec.widenGate':
    'Doubling bottleneck-zone gate width projected to improve outflow by 40%',

  // Insight engine — congestion
  'insight.congestion.critical.problem': '{zone}: Immediate entry restriction needed',
  'insight.congestion.critical.cause':
    'Current {occupancy} / capacity {capacity} ({pct}%)',
  'insight.congestion.critical.rec': '→ Add gate or expand zone area',
  'insight.congestion.warning.problem': '{zone}: Disperse flow recommended',
  'insight.congestion.warning.cause':
    'Utilization {pct}% — insufficient buffer',
  'insight.congestion.warning.rec': '→ Redistribute attractions to adjacent zones',

  // Insight engine — bottleneck
  'insight.bottleneck.group.problem': '{zone}: Review group flow separation',
  'insight.bottleneck.critical.problem': '{zone}: Urgently widen exit gate',
  'insight.bottleneck.warning.problem': '{zone}: Improve exit flow',
  'insight.bottleneck.cause':
    'Inflow {flowIn}/s > outflow {flowOut}/s — bottleneck index {score}',
  'insight.bottleneck.group.rec':
    '→ Widen gate or stagger tour schedules',
  'insight.bottleneck.nonGroup.rec':
    '→ Add exit gate or spread media placement',

  // Insight engine — density
  'insight.density.problem': '{zone}: Expand area or set capacity cap',
  'insight.density.cause':
    'Density {areaPerPerson}m²/person < threshold {standard}m²/person ({occupancy} / {area}m²)',
  'insight.density.rec':
    '→ Set cap to {safeCap} or expand by {expandM2}m²',

  // Insight engine — skip
  'insight.skip.problem': 'Consider duplicating popular media',
  'insight.skip.cause':
    'Global skip rate {pct}% — visitors abandon due to wait time',
  'insight.skip.rec.withHighSkip':
    '→ Duplicate {count} high-skip media or introduce queue management',
  'insight.skip.rec.default':
    '→ Duplicate placement or introduce queue management',

  // Insight engine — fatigue
  'insight.fatigue.problem': 'Add rest zone',
  'insight.fatigue.cause':
    'Visitor P90 fatigue exceeds {pct}% — insufficient rest area',
  'insight.fatigue.rec': '→ Place midway rest zone or shorten flow',

  // Insight engine — flow efficiency
  'insight.flow.problem': 'Relocate flagship content',
  'insight.flow.cause':
    'Completion rate {pct}% — over half leave early',
  'insight.flow.rec':
    '→ Place key content early in the flow to maintain motivation',

  // Insight engine — space ROI
  'insight.spaceRoi.low.problem': '{names}: Review downsizing or replacement',
  'insight.spaceRoi.low.cause':
    '{pct}% of avg space ROI — low watch time per area',
  'insight.spaceRoi.low.rec':
    '→ Shrink, reposition, or replace with more attractive content',
  'insight.spaceRoi.high.problem': '{name}: Expand similar content',
  'insight.spaceRoi.high.cause':
    '{pct}% of avg space ROI — top watch density ({count} viewers)',
  'insight.spaceRoi.high.rec':
    '→ Improve access and add similar content',

  // Insight engine — content mix
  'insight.contentMix.capacity.problem': '{category}: Increase capacity',
  'insight.contentMix.layout.problem': '{category}: Improve layout',
  'insight.contentMix.cause':
    'Skip rate {pct}% ({count} items / {skipCount} skips, avg watch {avgSec}s)',
  'insight.contentMix.capacity.rec':
    '→ Duplicate placement or add same-type media',
  'insight.contentMix.layout.rec':
    '→ Adjust spacing or interleave with other categories',

  // Insight engine — category labels (content mix)
  'insight.category.analog': 'Analog',
  'insight.category.passive_media': 'Passive Media',
  'insight.category.active': 'Active',
  'insight.category.immersive': 'Immersive',

  // Insight engine — group impact
  'insight.groupImpact.tour.problem': 'Review docent-only flow',
  'insight.groupImpact.tour.cause':
    '{tourPct}% tour visitors cause {impactPct}% of bottlenecks ({groupCount} groups / {tourCount} people)',
  'insight.groupImpact.tour.rec':
    '→ Stagger tour schedules or provide detour routes',
  'insight.groupImpact.fatigue.problem': 'Add rest zone on group flow',
  'insight.groupImpact.fatigue.cause':
    'Group fatigue {groupPct}% vs solo {soloPct}% ({count} visitors with higher dwell multiplier)',
  'insight.groupImpact.fatigue.rec':
    '→ Add midway rest zone on group flow or reduce content count',

  // Insight engine — content fatigue
  'insight.contentFatigue.problem': '{category}: Interleave with other categories',
  'insight.contentFatigue.cause':
    '{count} placed consecutively — skip rate {pct}% (fatigue accumulation)',
  'insight.contentFatigue.rec':
    '→ Insert other-type content in between to vary rhythm',

  // Insight engine — fatigue category labels
  'insight.fatigueCategory.analog': 'Analog exhibits',
  'insight.fatigueCategory.screen': 'Screen media',
  'insight.fatigueCategory.interactive': 'Interactive experience',
  'insight.fatigueCategory.immersive': 'Immersive experience',

  // Analytics panel — title tooltips
  'tooltip.summary':
    'Core KPI panel summarizing the current simulation state. Active is the number of visitors still in the venue; Spawned and Exited are the cumulative entries and departures since start; Fatigue is the mean fatigue across all visitors; Thru/min is the exit rate over the last minute; Elapsed is total simulation time; Peak Zone shows the zone with the highest utilization.',
  'tooltip.agentDistribution':
    'Proportional bar chart of what active visitors are currently doing. Five states are tracked — MOVING (between zones), WATCHING (viewing media), WAITING (in queue), RESTING (on break), and EXITING (heading out) — with bar length reflecting each action\'s share of the active population.',
  'tooltip.insights':
    'Auto-generated recommendations derived from live simulation data. Severity is categorized into critical (red, immediate action), warning (amber, review advised), and info (blue, informational). Each card\'s action button jumps directly to the editor for the affected zone or media.',
  'tooltip.liveDashboard':
    'Four live metrics paired with recent-history sparklines. Active counts visitors inside the venue, Watching counts those currently viewing media, Peak Util shows the utilization of the busiest zone, and Fatigue is the population-average fatigue level.',
  'tooltip.zoneRanking':
    'Sortable table comparing congestion and density across zones. Occ shows current/capacity, Util% is utilization (100% = full), and m²/p is floor area per person — values below the international guideline of 2.5 m² are flagged in red. Click any column header to sort ascending or descending by that metric.',
  'tooltip.nodeTraffic':
    'Traffic panel showing how many visitors traversed each node in the waypoint graph. Entry nodes count spawns, Exit nodes count departures, and other nodes count pass-throughs along the route. Bar length shows traffic relative to the busiest node.',

  // Left panel — section tooltips
  'tooltip.project':
    'Project management panel. Creates a new scenario, saves the current project to a JSON file with version metadata, or opens an existing project file. The list below shows recently used projects for quick access.',
  'tooltip.simulation':
    'Simulation control panel. Starts, pauses, and stops the agent-based simulation and toggles the heatmap overlay. During a run, the current Phase and Elapsed time are displayed alongside the active agent count.',
  'tooltip.spawn':
    'Visitor spawn configuration. Defines time slots, per-second spawn rates, and the mix of visitor profiles entering the venue over the simulation duration.',
  'tooltip.visitors':
    'Visitor profile configuration. Adjusts demographic proportions, engagement levels, group size distribution, and behavioral parameters such as patience and walking speed for the simulated population.',
  'tooltip.zones':
    'List of exhibition zones in flow order. Entrance is always first and Exit is always last. Middle zones can be dragged to reorder, and clicking a zone selects it for editing. The number in parentheses is the total zone count.',

  // Media editor — field tooltips
  'tooltip.media.orientation':
    'Front-facing direction of the media (0°=up, 90°=right, 180°=down, 270°=left). Determines the viewing area where visitors gather to watch.',
  'tooltip.media.interaction':
    'Interaction type. Passive = visitors watch from a distance (e.g. media wall). Active = visitors enter the media box (e.g. kiosk). Staged = session-based group entry at fixed intervals (e.g. VR). Analog = physical exhibit with visitors standing close outside the box.',
  'tooltip.media.omnidirectional':
    'When enabled, visitors may approach from any direction (360°), which suits centrally placed exhibits such as artifacts or sculptures. When disabled, visitors gather in front of the media based on the Orientation setting.',
  'tooltip.media.stageInterval':
    'Interval between sessions for Staged media. Visitors wait at the entry point and enter as a group when the next session begins.',
  'tooltip.media.capacity':
    'Maximum simultaneous viewers. Active and Staged types enforce a hard cap through slot allocation, while Passive type applies a soft cap that allows slight overflow.',
  'tooltip.media.engagement':
    'Average time a visitor spends engaging with this media. Actual duration varies with the visitor profile, engagement level, and current fatigue.',
  'tooltip.media.viewDistance':
    'Distance from the media at which visitors stand to watch. Larger values place viewers farther away (e.g. media wall), while smaller values keep them close to the exhibit.',
  'tooltip.media.attractiveness':
    'Likelihood that visitors choose this media (0–1 scale). Higher values attract more visitors and shift overall flow patterns toward this media.',
  'tooltip.media.queueBehavior':
    'Queue behavior when capacity is reached. None = skip the media and move on. Linear = form a single waiting line. Area = wait within a designated zone near the media.',
  'tooltip.media.groupFriendly':
    'Whether visitor groups can experience this media together. When enabled, group members share engagement time and enter or exit as a unit.',

  // Visitor config — skip threshold
  'tooltip.skipFormula':
    'Defines the condition under which a visitor gives up waiting for a media and moves on. When the actual wait time exceeds Patience × Attractiveness × Skip Multiplier × Max Wait, the visitor skips and heads to the next destination. Larger values make visitors more tolerant of queues; smaller values cause earlier skipping.',
};
