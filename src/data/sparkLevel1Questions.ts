export type SparkPillarId = "social" | "purpose" | "achievement" | "risk" | "knowledge";

export interface SparkPillarMeta {
  id: SparkPillarId;
  title: string;
  shortDescription: string;
  businessMeaning: string;
}

export interface SparkLevel1Question {
  id: string;
  number: number;
  pillar: SparkPillarId;
  prompt: string;
}

export interface LikertOption {
  value: number;
  label: string;
}

export const sparkPillars: SparkPillarMeta[] = [
  {
    id: "social",
    title: "Social",
    shortDescription: "Belonging, trust, collaboration, and psychological safety.",
    businessMeaning: "Social conditions shape whether coordination feels supportive, respectful, and reliable.",
  },
  {
    id: "purpose",
    title: "Purpose",
    shortDescription: "Direction, meaning, role clarity, and line-of-sight to goals.",
    businessMeaning: "Purpose conditions show whether people understand why the work matters and where effort should go.",
  },
  {
    id: "achievement",
    title: "Achievement",
    shortDescription: "Feedback, recognition, capability confidence, and growth in role.",
    businessMeaning: "Achievement conditions reveal whether progress is visible, supported, and credible.",
  },
  {
    id: "risk",
    title: "Risk",
    shortDescription: "Thoughtful experimentation, supported challenge, and learning through uncertainty.",
    businessMeaning: "Risk conditions indicate whether people can test ideas, speak up, and grow without fear-based hesitation.",
  },
  {
    id: "knowledge",
    title: "Knowledge",
    shortDescription: "Information access, communication clarity, and development support.",
    businessMeaning: "Knowledge conditions shape whether people can work with clear guidance and build capability over time.",
  },
];

export const sparkLevel1Questions: SparkLevel1Question[] = [
  { id: "q1", number: 1, pillar: "social", prompt: "I feel a genuine sense of belonging within this organization." },
  { id: "q2", number: 2, pillar: "social", prompt: "My relationships with colleagues are supportive and respectful." },
  { id: "q3", number: 3, pillar: "social", prompt: "I feel psychologically safe expressing ideas or concerns." },
  { id: "q4", number: 4, pillar: "social", prompt: "Collaboration is encouraged and effective." },
  { id: "q5", number: 5, pillar: "purpose", prompt: "I understand how my work contributes to meaningful outcomes." },
  { id: "q6", number: 6, pillar: "purpose", prompt: "The organization’s direction is clear and well communicated." },
  { id: "q7", number: 7, pillar: "purpose", prompt: "The work we do feels important and worthwhile." },
  { id: "q8", number: 8, pillar: "purpose", prompt: "I understand how my role connects to broader goals." },
  { id: "q9", number: 9, pillar: "achievement", prompt: "I have opportunities to improve and refine my skills." },
  { id: "q10", number: 10, pillar: "achievement", prompt: "My contributions are recognized appropriately." },
  { id: "q11", number: 11, pillar: "achievement", prompt: "I receive feedback that helps me improve." },
  { id: "q12", number: 12, pillar: "achievement", prompt: "I feel capable and effective in my role." },
  { id: "q13", number: 13, pillar: "risk", prompt: "I feel safe taking thoughtful risks in my work." },
  { id: "q14", number: 14, pillar: "risk", prompt: "New ideas and experimentation are supported." },
  { id: "q15", number: 15, pillar: "risk", prompt: "I am challenged in ways that support growth." },
  { id: "q16", number: 16, pillar: "risk", prompt: "Mistakes are treated as opportunities to learn." },
  { id: "q17", number: 17, pillar: "knowledge", prompt: "I have access to the information I need to do my job well." },
  { id: "q18", number: 18, pillar: "knowledge", prompt: "Learning and development are supported." },
  { id: "q19", number: 19, pillar: "knowledge", prompt: "Information is shared clearly and consistently." },
  { id: "q20", number: 20, pillar: "knowledge", prompt: "I see opportunities for long-term growth here." },
];

export const sparkScaleOptions: LikertOption[] = [
  { value: 1, label: "Strongly Disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly Agree" },
];
