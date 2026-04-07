import mermaid from "mermaid";
import { useEffect, useRef } from "react";
import { useThemeChange } from "@/app/hooks/use-theme-change";
import { darkTheme } from "../styles/dark";
import { lightTheme } from "../styles/light";

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

mermaid.registerIconPacks([
  {
    name: "logos",
    loader: () => import("@iconify-json/logos").then((module) => module.icons),
  },
]);

const darkThemeVariables: MermaidThemeVariables = {
  fontFamily: "Jetbrains Mono, sans-serif",
  background: darkTheme.colors.background,
  primaryColor: darkTheme.colors.primary.DEFAULT,
  secondaryColor: darkTheme.colors.secondary.DEFAULT,
  tertiaryColor: darkTheme.colors.info.DEFAULT,
  primaryTextColor: darkTheme.colors.foreground,
  secondaryTextColor: darkTheme.colors.foreground,
  tertiaryTextColor: darkTheme.colors.foreground,
  lineColor: darkTheme.colors.border,
  primaryBorderColor: darkTheme.colors.primary.subtle,
  secondaryBorderColor: darkTheme.colors.secondary.subtle,
  tertiaryBorderColor: darkTheme.colors.info.subtle,
  edgeLabelBackground: darkTheme.colors.card.background,
  noteBkgColor: darkTheme.colors.warn.DEFAULT,
  noteTextColor: darkTheme.colors.warn.foreground,
  noteBorderColor: darkTheme.colors.warn.subtle,
  textColor: darkTheme.colors.foreground,
  nodeBkg: darkTheme.colors.card.muted,
  nodeBorder: darkTheme.colors.border,
  nodeTextColor: darkTheme.colors.foreground,
  clusterBkg: darkTheme.colors.card.background,
  clusterBorder: darkTheme.colors.card.border,
  defaultLinkColor: darkTheme.colors.disabled,
  actorBkg: darkTheme.colors.card.muted,
  actorBorder: darkTheme.colors.primary.DEFAULT,
  actorTextColor: darkTheme.colors.foreground,
  actorLineColor: darkTheme.colors.border,
  signalColor: darkTheme.colors.disabled,
  signalTextColor: darkTheme.colors.foreground,
  activationBkgColor: darkTheme.colors.primary.subtle,
  activationBorderColor: darkTheme.colors.primary.DEFAULT,
};

const lightThemeVariables: MermaidThemeVariables = {
  fontFamily: "Jetbrains Mono, sans-serif",
  background: lightTheme.colors.background,
  primaryColor: lightTheme.colors.primary.DEFAULT,
  secondaryColor: lightTheme.colors.secondary.DEFAULT,
  tertiaryColor: lightTheme.colors.info.DEFAULT,
  primaryTextColor: lightTheme.colors.foreground,
  secondaryTextColor: lightTheme.colors.foreground,
  tertiaryTextColor: lightTheme.colors.foreground,
  lineColor: lightTheme.colors.border,
  primaryBorderColor: lightTheme.colors.primary.subtle,
  secondaryBorderColor: lightTheme.colors.secondary.subtle,
  tertiaryBorderColor: lightTheme.colors.info.subtle,
  edgeLabelBackground: lightTheme.colors.card.background,
  noteBkgColor: lightTheme.colors.warn.DEFAULT,
  noteTextColor: lightTheme.colors.foreground,
  noteBorderColor: lightTheme.colors.warn.subtle,
  textColor: lightTheme.colors.foreground,
  nodeBkg: lightTheme.colors.floating.background,
  nodeBorder: lightTheme.colors.border,
  nodeTextColor: lightTheme.colors.foreground,
  clusterBkg: lightTheme.colors.card.background,
  clusterBorder: lightTheme.colors.card.border,
  defaultLinkColor: lightTheme.colors.disabled,
  actorBkg: lightTheme.colors.floating.background,
  actorBorder: lightTheme.colors.primary.DEFAULT,
  actorTextColor: lightTheme.colors.foreground,
  actorLineColor: lightTheme.colors.border,
  signalColor: lightTheme.colors.disabled,
  signalTextColor: lightTheme.colors.foreground,
  activationBkgColor: lightTheme.colors.primary.subtle,
  activationBorderColor: lightTheme.colors.primary.DEFAULT,
};

const getMermaidConfig = (
  isDark: boolean,
): Parameters<typeof mermaid.initialize>[0] => ({
  theme: "base",
  startOnLoad: false,
  markdownAutoWrap: true,
  securityLevel: "loose",
  arrowMarkerAbsolute: true,
  themeVariables: isDark ? darkThemeVariables : lightThemeVariables,
});

export const Mermaid = (props: { chart: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const renderChart = async () => {
    const container = containerRef.current;
    if (!container || !props.chart) return;
    container.innerHTML = props.chart;
    container.removeAttribute("data-processed");
    await mermaid.run({ nodes: [container] });
  };

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    mermaid.initialize(getMermaidConfig(isDark));
    renderChart();
  }, []);

  useThemeChange(() => {
    const nowDark = document.documentElement.classList.contains("dark");
    mermaid.initialize(getMermaidConfig(nowDark));
    renderChart();
  });

  useEffect(() => {
    renderChart();
  }, [props.chart]);

  return (
    <div ref={containerRef} className="mermaid">
      {props.chart}
    </div>
  );
};
