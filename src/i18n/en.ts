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
  'build.node.portal.desc': 'Cross-floor/building transit hub (grouped by shaft)',

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

  // Sensitivity panel — UI labels
  'sensitivity.title': 'Sensitivity Analysis',
  'sensitivity.current': 'Current',
  'sensitivity.impact.high': 'HIGH',
  'sensitivity.impact.medium': 'MEDIUM',
  'sensitivity.impact.low': 'LOW',
  'sensitivity.factor.entranceCapacity': 'Entrance Capacity',
  'sensitivity.factor.spawnRate': 'Spawn Rate',
  'sensitivity.factor.exhibitionArea': 'Exhibition Area',
  'sensitivity.factor.restCapacity': 'Rest Area Capacity',
  'sensitivity.factor.gateWidth': 'Gate Width',
  'sensitivity.unit.visitors': 'visitors',
  'sensitivity.unit.perSec': '/s',
  'sensitivity.unit.zones': 'zones',
  'sensitivity.unit.seats': 'seats',
  'sensitivity.unit.px': 'px',

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
  'insight.bottleneck.group.problem': '{zone}: Tour arrivals concentrating',
  'insight.bottleneck.critical.problem': '{zone}: Exit throughput exceeded',
  'insight.bottleneck.warning.problem': '{zone}: Exit flow slowing',
  'insight.bottleneck.cause':
    'Inflow {flowIn}/s > outflow {flowOut}/s — bottleneck index {score}',
  'insight.bottleneck.group.rec':
    '→ Stagger tour time slots or reduce tour ratio',
  'insight.bottleneck.nonGroup.rec':
    '→ Add exit gate or raise zone capacity',

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
    '→ Duplicate {count} high-skip media or raise their capacity',
  'insight.skip.rec.default':
    '→ Duplicate placement or raise media capacity',

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
    '→ Stagger tour time slots or reduce tour ratio',
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

  // Zone editor — capacity semantics
  'tooltip.zone.capacity':
    'Spatial headcount capacity for the entire zone. Auto-derived from area using the international density standard (2.5 m²/person); exceeding this value penalizes routes into the zone so fewer visitors funnel in.',

  // Node (waypoint) inspector — field tooltips
  'tooltip.node.attraction':
    'Weight in the route-selection Score formula (0–1). Higher values pull more visitors toward this node; used to tune the relative pull of attractor or rest waypoints.',
  'tooltip.node.dwell':
    'Time a visitor stays on first visit to this node. Applies only to rest and attractor types — tune it for brief pauses along the path or for headline exhibits.',
  'tooltip.node.capacity':
    'POI crowding threshold (how many visitors can cluster at this single point). Unlike zone spatial capacity, this drives the crowd-density penalty in the Score formula — smaller values flag the node as "crowded" sooner and redirect visitors elsewhere.',
  'tooltip.node.spawnWeight':
    'Relative spawn probability across multiple Entry nodes. Higher values cause a larger share of the total population to appear at this entrance.',

  // Experience tab — panel tooltips
  'tooltip.experience.timeSpent':
    'Distribution of how long visitors stayed in the venue (from entry to exit, in minutes). Green bars are visitors who have already left (final stay duration); blue bars are visitors still inside (time elapsed so far). Bucket width scales with the longest stay observed.',
  'tooltip.experience.quality':
    'Overall experience quality for active visitors. Depth is how many media each visitor has seen (distribution by 0, 1–2, 3–5, 6+ buckets); Avg Fatigue is the mean fatigue level (>60% is red, >40% is amber); High Fatigue shows the share of visitors above 70% fatigue — a signal of over-stimulation or excessive dwell.',
  'tooltip.experience.zoneMedia':
    'Per-zone media performance. Each row aggregates its zone\'s media: watch count (w), skip rate (%), average watch time, and peak viewers vs. total capacity. Expand a row to inspect individual media. Live indicators — ● watching, ↻ waiting — appear on the right when visitors are engaged.',
  'tooltip.experience.flowVsExperience':
    'Trade-off between traffic volume and experience depth per zone. Pop is the current occupancy; Depth is average media watched (watched/total) — red when below 0.5; Fatigue is the zone\'s mean visitor fatigue. A ⟿ icon flags rush-through zones where visitors traverse without engaging.',

  // Experience tab — Time Spent chart labels
  'experience.timeSpent.title': 'Time Spent Distribution',
  'experience.timeSpent.exited': 'Exited',
  'experience.timeSpent.ongoing': 'Ongoing',
  'experience.timeSpent.avg': 'avg',

  // VELA Report — toolbar
  'vela.toolbar.export': 'Export PDF',
  'vela.toolbar.exporting': 'Exporting...',
  'vela.foot.product': 'VELA — Spatial Simulation & Flow Analytics · Report v5',
  'vela.foot.generated': 'Generated {date}',
  'vela.loadScenario': 'Please load a scenario first.',
  'vela.noSimTitle': 'No simulation data',
  'vela.noSimBody': 'This scenario has not been run yet.\n▶ Run the simulation and reopen.',

  // VELA Report — Hero
  'vela.hero.brand': 'VELA · Spatial Simulation Report',
  'vela.hero.line': 'Report · {version} · {date}',
  'vela.hero.titleA': 'Spatial',
  'vela.hero.titleB': 'Report',
  'vela.hero.subtitleA': 'We measure not capacity — but the ',
  'vela.hero.subtitleEm': 'qualitative distribution',
  'vela.hero.subtitleB': ' of experience.',
  'vela.hero.kGenerated': 'Generated',
  'vela.hero.kDuration': 'Simulated',
  'vela.hero.kVisitors': 'Visitors',
  'vela.hero.visitorsFmt': '{count}',
  'vela.hero.kVersion': 'Version',

  // VELA Report — TL;DR
  'vela.tldr.eyebrow': 'Key Insight',
  'vela.tldr.headlineA': "The answer isn't dispersing people—",
  'vela.tldr.headlineB': "it's dispersing the experience.",

  // VELA Report — Data-derived Key Verdict
  'vela.verdict.over.a': '{zone} reached {pct}% of capacity.',
  'vela.verdict.over.b': 'Over design capacity — a physical-safety threshold was breached.',
  'vela.verdict.group.a': '{induced} of {count} bottlenecks arose from group flows.',
  'vela.verdict.group.b': 'Group entries and solo visitors share the same gate — redirect one.',
  'vela.verdict.skip.a': '{pct}% of visitors skipped content.',
  'vela.verdict.skip.b': 'Exposure existed but did not translate into viewing.',
  'vela.verdict.fatigue.a': 'Top 10% fatigue reached {pct}%.',
  'vela.verdict.fatigue.b': 'Experience quality drops sharply in the later half of the route.',
  'vela.verdict.completion.a': 'Only {pct}% visited 3+ zones.',
  'vela.verdict.completion.b': 'Visitors drop off before reaching core content.',
  'vela.verdict.activation.a': 'Only {pct}% of media was actually used.',
  'vela.verdict.activation.b': 'More than half the content sits in flow blind spots.',
  'vela.verdict.balanced.a': 'Peak {peak}% · Activation {activation}% · Skip {skip}%',
  'vela.verdict.balanced.b': 'All key indicators stayed within thresholds.',

  // VELA Report — Executive
  'vela.exec.eyebrow': 'Executive Summary',
  'vela.exec.titleA': 'Executive',
  'vela.exec.titleB': 'Summary',
  'vela.exec.meta': '{visitors} visitors',
  'vela.exec.safeLimit': '0 · 100% safe limit · ',
  'vela.sev.critical': 'Critical',
  'vela.sev.warning': 'Warning',
  'vela.sev.info': 'Info',

  // VELA Report — Density
  'vela.density.eyebrow': 'Spatial Density',
  'vela.density.titleA': 'Spatial',
  'vela.density.titleB': 'Density',
  'vela.density.titleC': ' at peak',
  'vela.density.metaWithPeak': 'Peak @ {moment} · P90 {p90}%',
  'vela.density.metaNoPeak': 'P90 {p90}%',
  'vela.density.introWithMoment': ' at the peak-fatigue moment ({moment})',
  'vela.density.intro':
    'Zone density by floor{introMoment}. Cells show occupancy vs. capacity (%); redder means more crowded.',
  'vela.density.lg.lt30': '<30%',
  'vela.density.lg.range1': '30–60%',
  'vela.density.lg.range2': '60–85%',
  'vela.density.lg.range3': '85–100%',
  'vela.density.lg.over': 'over capacity',

  // VELA Report — Timeline
  'vela.tl.eyebrow': 'Timeline',
  'vela.tl.titleA': 'Timeline',
  'vela.tl.titleEm': 'of change',
  'vela.tl.metaPeak': '{start} — {end} · PEAK {peak}',
  'vela.tl.metaRange': '{start} — {end}',
  'vela.tl.intro':
    'Peak crowding, average fatigue, and active visitor count over the simulation run.',
  'vela.tl.chartTitle': 'Crowding · Fatigue · Active visitors',
  'vela.tl.l.peak': 'Peak crowding %',
  'vela.tl.l.fatigue': 'Avg. fatigue %',
  'vela.tl.l.active': 'Active visitors',
  'vela.tl.callout.label': 'Peak Moment · {moment}',
  'vela.tl.callout.reached': '{zone} reached {pct}% of capacity',
  'vela.tl.callout.structural': '. Observed as structural crowding, not a transient event.',
  'vela.tl.callout.dot': '.',
  'vela.tl.callout.supp': 'At this moment: {active} active visitors, mean fatigue {fatigue}% — capacity and experience density peaked together.',
  'vela.tl.exit.title': 'Cumulative Exits',
  'vela.tl.exit.hint': 'Cumulative visitors exited over time ({total} completed) — how quickly the facility empties.',
  'vela.tl.rank.title': 'Zone ranking at {moment}',
  'vela.tl.rank.titleNoPeak': 'Peak zone ranking',
  'vela.tl.rank.hint': 'Zones with highest utilization at the peak moment — reveals simultaneous pressure patterns.',

  // VELA Report — System overview
  'vela.sys.eyebrow': 'Space Configuration',
  'vela.sys.titleA': 'Space',
  'vela.sys.titleB': 'configuration',
  'vela.sys.meta': '{zones} zones · {media} media · {area} m²',
  'vela.sys.col.visitDist': 'Zone Dwell Distribution',
  'vela.sys.col.composition': 'Composition',
  'vela.sys.donut.visits': 'VISITS',
  'vela.sys.donut.dwellMin': 'DWELL (min)',
  'vela.sys.donut.noData': 'NO DATA',
  'vela.sys.donut.note': '{count} zones · {total} min cumulative dwell',
  'vela.sys.kv.zones': 'Zones',
  'vela.sys.kv.media': 'Media',
  'vela.sys.kv.area': 'Total area',
  'vela.sys.kv.capacity': 'Total capacity',
  'vela.sys.kv.mediaCap': 'Media capacity',
  'vela.sys.kv.avgCrowd': 'Avg. crowding',
  'vela.sys.kv.avgDwell': 'Avg. dwell time',
  'vela.sys.kv.throughput': 'Visitors per minute',
  'vela.sys.th.zone': 'Zone',
  'vela.sys.th.areaCap': 'Area / Cap.',
  'vela.sys.th.peak': 'Peak',
  'vela.sys.th.util': 'Utilization',
  'vela.sys.th.density': 'm²/person',
  'vela.sys.th.stay': 'Avg. stay',
  'vela.sys.th.trend': 'Trend',
  'vela.sys.th.bottleneck': 'Bottleneck',
  'vela.sys.th.grade': 'Grade',
  'vela.sys.td.capPrefix': 'Cap.',
  'vela.sys.td.stayUnit': 'm',
  'vela.sys.interpLabel': 'Interpretation',
  'vela.sys.interp.over':
    'System exceeded design capacity. {zone} reached {pct}% of capacity — structural crowding, not a transient event.',
  'vela.sys.interp.near':
    '{zone} reached {pct}% of capacity at peak — near saturation.',

  // VELA Report — Flow
  'vela.flow.eyebrow': 'Flow Analysis',
  'vela.flow.titleA': 'Flow &',
  'vela.flow.titleB': 'bottleneck',
  'vela.flow.meta': '{completed} completions · {bottlenecks} bottlenecks',
  'vela.flow.col.kpi': 'Flow KPI',
  'vela.flow.col.dist': 'Completion distribution',
  'vela.flow.kv.completed': 'Completed visitors',
  'vela.flow.kv.avgTotal': 'Avg. total duration',
  'vela.flow.kv.throughput': 'Visitors per minute',
  'vela.flow.kv.completion': 'Completion rate (≥3 zones)',
  'vela.flow.kv.exit': 'Exit rate (≤2 zones)',
  'vela.flow.kv.group': 'Group-induced bottleneck',
  'vela.flow.groupTip': 'Share of bottlenecks caused by tour groups sharing the same gate at the same time. High values suggest separating group entry windows or adding a dedicated flow.',
  'vela.flow.routes.title': 'Most-taken routes',
  'vela.flow.routes.hint': 'Top 5 zone sequences (from visitedZoneIds) — useful to check whether free-flow scenarios still concentrate on a dominant path.',
  'vela.flow.dwell.title': 'Dwell-time distribution',
  'vela.flow.dwell.hint': 'Histogram of total dwell time (minutes) for completed visitors. Median {median}m · P90 {p90}m · P99 {p99}m — reveals rushers vs. lingerers.',
  'vela.flow.dwell.axisLabel': 'Distribution (minutes)',
  'vela.flow.entry.title': 'Entry gate distribution',
  'vela.flow.entry.hint': 'Actual spawns per entry node. Deviation from configured weights signals early-minute crowding.',
  'vela.flow.entry.empty': 'No entry data',
  'vela.flow.exit.title': 'Exit gate distribution',
  'vela.flow.exit.hint': 'Actual departures per exit node. Concentration at one gate indicates an end-of-flow bottleneck.',
  'vela.flow.exit.empty': 'No exit data',
  'vela.flow.trans.title': 'Zone-to-zone transition matrix',
  'vela.flow.trans.hint': 'Each row is a from-zone; each column is the next-visited zone. Cell shows count and row-percentage. Darker cells mark dominant choices at that from-zone.',
  'vela.flow.note':
    'No significant bottleneck detected — exits are attributed to content abandonment, not queue blocking.',
  'vela.flow.dist.zero': '0 zones (immediate exit)',
  'vela.flow.dist.low': '1–2 zones (early exit)',
  'vela.flow.dist.mid': '3–4 zones (partial)',
  'vela.flow.dist.high': '5+ zones (complete)',

  // VELA Report — Behavior
  'vela.bhv.eyebrow': 'Behavior Analysis',
  'vela.bhv.titleA': 'Visitor',
  'vela.bhv.titleB': 'behavior',
  'vela.bhv.meta': 'Fatigue P90 {p90}% · P99 {p99}%',
  'vela.bhv.col.fatigue': 'Fatigue Distribution',
  'vela.bhv.col.composition': 'Visitor Composition',
  'vela.bhv.note.headline':
    'Once P90 exceeds 80%, experience quality in later zones structurally degrades.',
  'vela.bhv.note.stats':
    'Avg {avg}% · Median {median}% · P99 {p99}%',
  'vela.bhv.group':
    '{count} group(s) shape the overall flow, with {pct}% of detected bottlenecks originating from groups.',
  'vela.bhv.h.avg': 'avg {pct}%',
  'vela.bhv.h.median': 'median {pct}%',
  'vela.bhv.h.p90': 'P90 {pct}%',
  'vela.bhv.h.p99': 'P99',

  // VELA Report — Media
  'vela.media.eyebrow': 'Media Experience',
  'vela.media.titleA': 'Media',
  'vela.media.titleB': 'experience',
  'vela.media.meta': '{count} media · {activation}% activation',
  'vela.media.perf': '7.1 · Content performance',
  'vela.media.th.media': 'Media',
  'vela.media.th.zone': 'Zone',
  'vela.media.th.peakCap': 'Peak/Cap',
  'vela.media.th.viewsSkip': 'Views/Skip',
  'vela.media.th.engagement': 'Engagement',
  'vela.media.pick.topTitle': 'Top · Highest engagement',
  'vela.media.pick.topNote': 'engagement ≥ 70%',
  'vela.media.pick.lowTitle': 'Low · Needs improvement',
  'vela.media.pick.lowNote': 'engagement < 60% or skip high',
  'vela.media.tot.views': 'Total views',
  'vela.media.tot.skips': 'Total skips',
  'vela.media.tot.time': 'Total watch time',
  'vela.media.tot.activation': 'Content activation',
  'vela.media.u.views': 'views',
  'vela.media.u.skips': 'skips',
  'vela.media.u.min': 'min',

  // VELA Report — Recommendations
  'vela.recos.eyebrow': 'Recommendations',
  'vela.recos.title': 'Recommendations',
  'vela.recos.meta': '{count} actions · prioritized',
  'vela.recos.evidence': 'EVIDENCE · {metric} · {value} · threshold {threshold}',
  'vela.recos.actionH': 'Recommended action',

  // VELA Report — Appendix
  'vela.appendix.eyebrow': 'Appendix',
  'vela.appendix.title': 'Glossary',
  'vela.appendix.meta': 'Glossary',

  // VELA Report — KPIs (Executive)
  'vela.kpi.peak.label': 'Peak Utilization',
  'vela.kpi.peak.note': '{zone} · Peak occupancy vs. design capacity',
  'vela.kpi.visitors.label': 'Total Visitors',
  'vela.kpi.visitors.note': 'Active {active} · Exited {exited}',
  'vela.kpi.stay.label': 'Avg. Stay',
  'vela.kpi.stay.unit': 'm',
  'vela.kpi.stay.note': 'Completion {pct}%',
  'vela.kpi.fatigue.label': 'Avg. Fatigue',
  'vela.kpi.fatigue.note': 'P90 {pct}%',
  'vela.kpi.skip.label': 'Skip Rate',
  'vela.kpi.skip.note': '{watches} views · {skips} skips',
  'vela.kpi.bottleneck.label': 'Bottleneck',
  'vela.kpi.bottleneck.note': '{count} group-induced',
  'vela.kpi.throughput.label': 'Throughput',
  'vela.kpi.throughput.unit': '/m',
  'vela.kpi.throughput.note': 'Visitors per minute',

  // VELA Report — Evidence labels
  'vela.ev.peak.label': 'Peak Utilization',
  'vela.ev.peak.noteOver': '{zone} — over capacity',
  'vela.ev.peak.note': '{zone}',
  'vela.ev.fatigue.label': 'Fatigue P90',
  'vela.ev.fatigue.note': 'Bottom 10% of visitors',
  'vela.ev.activation.label': 'Media Activation',
  'vela.ev.activation.note': '{active} of {total} media active',
  'vela.ev.skip.label': 'Skip Rate',
  'vela.ev.skip.note': '{views} views / {skips} skips',

  // VELA Report — Glossary terms
  'vela.gl.peak.term': 'Peak Utilization',
  'vela.gl.peak.def': 'Maximum simultaneous occupancy of a zone during the observed period ÷ design capacity.',
  'vela.gl.density.term': 'm²/person (space grade)',
  'vela.gl.density.def': 'Zone area ÷ occupancy at peak. Above 2.5 m²/person (international standard) is considered safe.',
  'vela.gl.bottleneck.term': 'Bottleneck Score',
  'vela.gl.bottleneck.def': 'Refined 0–1 index from inflow-outflow differential and wait time. >0.5 indicates a bottleneck.',
  'vela.gl.completion.term': 'Completion Rate',
  'vela.gl.completion.def': 'Share of visitors who visited ≥3 zones and exited normally.',
  'vela.gl.skip.term': 'Skip Rate',
  'vela.gl.skip.def': 'Share of visitors who reached a media unit but passed without viewing.',
  'vela.gl.engagement.term': 'Engagement Rate',
  'vela.gl.engagement.def': 'Media views ÷ total approaches (views + skips).',
  'vela.gl.fatigue.term': 'Fatigue P90 / P99',
  'vela.gl.fatigue.def': 'Top 10% / 1% of visitor fatigue values.',
  'vela.gl.group.term': 'Group-Induced Bottleneck',
  'vela.gl.group.def': 'A bottleneck where group visitors contributed ≥50% of the congestion.',

  // Completion modal
  'completionModal.title': 'Simulation Complete',
  'completionModal.duration': '{mins} minutes simulated',

  // Completion Report panel
  'completionReport.title': 'Report',
  'completionReport.viewFull': 'View Full Report (PDF)',
  'completionReport.runHint': 'Run simulation to generate report data.',
  'completionReport.analyzing': 'Analyzing...',

  // Pinpoint analysis
  'pinpoint.tab.label': 'Pin',
  'pinpoint.action.pin': 'Pin now',
  'pinpoint.action.remove': 'Remove',
  'pinpoint.action.clear': 'Clear all',
  'pinpoint.action.compare': 'Compare',
  'pinpoint.action.viewOnCanvas': 'Show on canvas',
  'pinpoint.shortcut.hint': 'Press P to pin',
  'pinpoint.toast.created': 'Pinned at {time}',
  'pinpoint.toast.maxCompare': 'Max {max} pins to compare',
  'pinpoint.toast.noSnapshot': 'Start a simulation first to capture pins',
  'regions.tooltip': 'Manage each region (floor). The active region is the default target for new zone / waypoint placement. Hide a region with the eye icon to focus editing. Use the image icon to manage the per-floor floorplan overlay.',
  'pinpoint.defaultLabel': 'Pin @ {time}',
  'pinpoint.empty.title': 'No pins yet',
  'pinpoint.empty.hint': 'While simulating, press P or click "Pin now" to save a moment',
  'pinpoint.timeline.title': 'PINS',
  'pinpoint.list.editLabel': 'Edit label',
  'pinpoint.detail.title': '{label}',
  'pinpoint.detail.meta': '{time} · {zones} zones / {media} media',
  'pinpoint.detail.kpi.active': 'Active',
  'pinpoint.detail.kpi.throughput': 'Thru/min',
  'pinpoint.detail.kpi.fatigue': 'Avg fatigue',
  'pinpoint.detail.zones': 'Zones at this moment',
  'pinpoint.detail.media': 'Media at this moment',
  'pinpoint.detail.th.zone': 'Zone',
  'pinpoint.detail.th.occCap': 'Occ/Cap',
  'pinpoint.detail.th.ratio': 'Ratio',
  'pinpoint.detail.th.comfort': 'Comfort',
  'pinpoint.detail.th.watching': 'Watching',
  'pinpoint.detail.th.waiting': 'Waiting',
  'pinpoint.detail.th.media': 'Media',
  'pinpoint.detail.th.viewers': 'Viewers',
  'pinpoint.detail.th.queue': 'Queue',
  'pinpoint.detail.th.skips': 'Skips',
  'pinpoint.detail.delta': 'vs. previous pin',
  'pinpoint.detail.noPrev': 'First pin',
  'pinpoint.compare.title': 'Pin comparison',
  'pinpoint.compare.metric.throughput': 'Throughput/min',
  'pinpoint.compare.metric.avgFatigue': 'Avg fatigue',
  'pinpoint.compare.metric.peakZone': 'Peak zone',
  'pinpoint.compare.metric.avgComfort': 'Avg comfort',
};
