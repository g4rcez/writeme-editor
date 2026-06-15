export type MermaidThemeVariables = {
  fontFamily?: string;
  background?: string;
  primaryColor?: string;
  secondaryColor?: string;
  tertiaryColor?: string;
  primaryTextColor?: string;
  secondaryTextColor?: string;
  tertiaryTextColor?: string;
  primaryBorderColor?: string;
  secondaryBorderColor?: string;
  tertiaryBorderColor?: string;
  noteBkgColor?: string;
  noteTextColor?: string;
  noteBorderColor?: string;
  lineColor?: string;
  textColor?: string;
  border2?: string;
  arrowheadColor?: string;

  // Flowchart
  nodeBkg?: string;
  mainBkg?: string;
  nodeBorder?: string;
  clusterBkg?: string;
  clusterBorder?: string;
  defaultLinkColor?: string;
  titleColor?: string;
  edgeLabelBackground?: string;
  nodeTextColor?: string;

  // Sequence Diagram
  actorBorder?: string;
  actorBkg?: string;
  actorTextColor?: string;
  actorLineColor?: string;
  labelBoxBkgColor?: string;
  signalColor?: string;
  signalTextColor?: string;
  labelBoxBorderColor?: string;
  labelTextColor?: string;
  loopTextColor?: string;
  activationBorderColor?: string;
  activationBkgColor?: string;
  sequenceNumberColor?: string;
  personBorder?: string;
  personBkg?: string;

  // Gantt chart
  sectionBkgColor?: string;
  altSectionBkgColor?: string;
  sectionBkgColor2?: string;
  excludeBkgColor?: string;
  taskBorderColor?: string;
  taskBkgColor?: string;
  activeTaskBorderColor?: string;
  activeTaskBkgColor?: string;
  gridColor?: string;
  doneTaskBkgColor?: string;
  doneTaskBorderColor?: string;
  critBorderColor?: string;
  critBkgColor?: string;
  todayLineColor?: string;
  vertLineColor?: string;
  taskTextColor?: string;
  taskTextOutsideColor?: string;
  taskTextLightColor?: string;
  taskTextDarkColor?: string;
  taskTextClickableColor?: string;

  // ER diagram
  rowOdd?: string;
  rowEven?: string;
  attributeBackgroundColorOdd?: string;
  attributeBackgroundColorEven?: string;

  // State colors
  transitionColor?: string;
  transitionLabelColor?: string;
  stateLabelColor?: string;
  stateBkg?: string;
  labelBackgroundColor?: string;
  compositeBackground?: string;
  altBackground?: string;
  compositeTitleBackground?: string;
  compositeBorder?: string;
  innerEndBackground?: string;
  errorBkgColor?: string;
  errorTextColor?: string;
  specialStateColor?: string;

  // Class diagram
  classText?: string;

  // Pie chart
  pie1?: string;
  pie2?: string;
  pie3?: string;
  pie4?: string;
  pie5?: string;
  pie6?: string;
  pie7?: string;
  pie8?: string;
  pie9?: string;
  pie10?: string;
  pie11?: string;
  pie12?: string;
  pieTitleTextColor?: string;
  pieSectionTextColor?: string;
  pieLegendTextColor?: string;
  pieStrokeColor?: string;
  pieOuterStrokeColor?: string;

  // Architecture diagram
  archEdgeColor?: string;
  archEdgeArrowColor?: string;
  archGroupBorderColor?: string;

  // Requirement diagram
  requirementBackground?: string;
  requirementBorderColor?: string;
  requirementTextColor?: string;
  relationColor?: string;
  relationLabelBackground?: string;
  relationLabelColor?: string;

  // Git graph
  git0?: string;
  git1?: string;
  git2?: string;
  git3?: string;
  git4?: string;
  git5?: string;
  git6?: string;
  git7?: string;
  gitInv0?: string;
  gitInv1?: string;
  gitInv2?: string;
  gitInv3?: string;
  gitInv4?: string;
  gitInv5?: string;
  gitInv6?: string;
  gitInv7?: string;
  branchLabelColor?: string;
  gitBranchLabel0?: string;
  gitBranchLabel1?: string;
  gitBranchLabel2?: string;
  gitBranchLabel3?: string;
  gitBranchLabel4?: string;
  gitBranchLabel5?: string;
  gitBranchLabel6?: string;
  gitBranchLabel7?: string;
  tagLabelColor?: string;
  tagLabelBackground?: string;
  tagLabelBorder?: string;
  commitLabelColor?: string;
  commitLabelBackground?: string;

  [key: string]: string | undefined;
};

export type MermaidTokenReader = (name: string) => string;

export const cssVarToken = (name: string): string => `hsla(var(--${name}))`;

export const readThemeToken: MermaidTokenReader = (name: string): string => {
  if (typeof document === "undefined") return cssVarToken(name);

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${name}`)
    .trim();

  if (!value) return cssVarToken(name);
  if (value.startsWith("hsl") || value.startsWith("rgb")) return value;
  return `hsla(${value})`;
};

export const createMermaidThemeVariables = (
  readToken: MermaidTokenReader = readThemeToken,
): MermaidThemeVariables => {
  const background = readToken("background");
  const foreground = readToken("foreground");
  const border = readToken("border");
  const cardBackground = readToken("card-background");
  const cardMuted = readToken("card-muted");
  const primary = readToken("primary-DEFAULT");
  const primarySubtle = readToken("primary-subtle");
  const warnBg = readToken("button-warn-bg");
  const warnText = readToken("button-warn-text");

  return {
    fontFamily: "JetBrains Mono Variable, JetBrains Mono, monospace",
    background,
    primaryColor: primarySubtle,
    secondaryColor: cardMuted,
    tertiaryColor: cardBackground,
    primaryTextColor: foreground,
    secondaryTextColor: foreground,
    tertiaryTextColor: foreground,
    lineColor: foreground,
    primaryBorderColor: primary,
    secondaryBorderColor: foreground,
    tertiaryBorderColor: foreground,
    edgeLabelBackground: background,
    noteBkgColor: warnBg,
    noteTextColor: warnText,
    noteBorderColor: warnBg,
    textColor: foreground,
    border2: border,
    arrowheadColor: foreground,
    nodeBkg: primarySubtle,
    mainBkg: primarySubtle,
    nodeBorder: primary,
    nodeTextColor: foreground,
    clusterBkg: cardBackground,
    clusterBorder: foreground,
    defaultLinkColor: foreground,
    actorBkg: cardMuted,
    actorBorder: foreground,
    actorTextColor: foreground,
    actorLineColor: foreground,
    signalColor: foreground,
    signalTextColor: foreground,
    labelBoxBkgColor: background,
    labelBoxBorderColor: foreground,
    labelTextColor: foreground,
    loopTextColor: foreground,
    activationBkgColor: cardMuted,
    activationBorderColor: foreground,
    sequenceNumberColor: foreground,
    personBorder: foreground,
    personBkg: cardMuted,
    sectionBkgColor: cardMuted,
    altSectionBkgColor: cardBackground,
    sectionBkgColor2: cardMuted,
    excludeBkgColor: cardBackground,
    taskBorderColor: foreground,
    taskBkgColor: primarySubtle,
    activeTaskBorderColor: foreground,
    activeTaskBkgColor: warnBg,
    gridColor: border,
    doneTaskBkgColor: cardMuted,
    doneTaskBorderColor: foreground,
    critBorderColor: foreground,
    critBkgColor: warnBg,
    todayLineColor: warnBg,
    vertLineColor: foreground,
    taskTextColor: foreground,
    taskTextOutsideColor: foreground,
    taskTextLightColor: foreground,
    taskTextDarkColor: foreground,
    taskTextClickableColor: foreground,
    rowOdd: cardBackground,
    rowEven: cardMuted,
    attributeBackgroundColorOdd: cardBackground,
    attributeBackgroundColorEven: cardMuted,
    transitionColor: foreground,
    transitionLabelColor: foreground,
    stateLabelColor: foreground,
    stateBkg: primarySubtle,
    labelBackgroundColor: background,
    compositeBackground: cardBackground,
    altBackground: cardMuted,
    compositeTitleBackground: cardMuted,
    compositeBorder: foreground,
    innerEndBackground: foreground,
    errorBkgColor: warnBg,
    errorTextColor: warnText,
    specialStateColor: primarySubtle,
    classText: foreground,
    pieTitleTextColor: foreground,
    pieSectionTextColor: foreground,
    pieLegendTextColor: foreground,
    pieStrokeColor: background,
    pieOuterStrokeColor: foreground,
    archEdgeColor: foreground,
    archEdgeArrowColor: foreground,
    archGroupBorderColor: foreground,
    requirementBackground: primarySubtle,
    requirementBorderColor: foreground,
    requirementTextColor: foreground,
    relationColor: foreground,
    relationLabelBackground: background,
    relationLabelColor: foreground,
    branchLabelColor: foreground,
    tagLabelColor: foreground,
    tagLabelBackground: primarySubtle,
    tagLabelBorder: foreground,
    commitLabelColor: foreground,
    commitLabelBackground: background,
  };
};
