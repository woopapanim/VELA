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
    'Real-time KPIs. Active = visitors in venue now. Spawned/Exited = cumulative. Thru/min = exit throughput per minute.',
  'tooltip.agentDistribution':
    'Live breakdown of what agents are doing right now: MOVING, WATCHING, WAITING, RESTING, EXITING.',
  'tooltip.insights':
    'Actionable recommendations from live simulation data. Red = critical, amber = warning. Click action buttons to jump to the affected zone or media.',
  'tooltip.liveDashboard':
    'Live flow metrics updated each tick: throughput, density, congestion indicators.',
  'tooltip.zoneRanking':
    'Zones ranked by occupancy and activity. Higher bar = busier zone relative to capacity.',
  'tooltip.nodeTraffic':
    'Visitor count per waypoint node. Entry nodes = spawns, Exit nodes = departures, others = pass-through counts.',
};
