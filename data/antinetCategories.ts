// data/antinetCategories.ts
// Complete Antinet System Categories — Properly Nested Hierarchy

export interface Category {
  id: string;
  title: string;
  range: string;
  description?: string;
  isLeaf?: boolean;
  children?: Category[];
}

export const antinetCategories: Category[] = [
  {
    id: "0000",
    title: "Philosophy and Ethics",
    range: "0000-0999",
    children: [
      {
        id: "0000-0099",
        title: "Metaphysics",
        range: "0000-0099",
        description: "The nature of reality, existence, and being.",
        children: [
          { id: "0001", title: "Natural Laws", range: "0001", isLeaf: true }
        ]
      },
      {
        id: "0100-0199",
        title: "Epistemology",
        range: "0100-0199",
        description: "The study of knowledge, belief, and justification.",
        children: [
          { id: "0101", title: "Wisdom", range: "0101", isLeaf: true },
          { id: "0102", title: "Knowledge", range: "0102", isLeaf: true }
        ]
      },
      { id: "0200-0299", title: "Logic and Reasoning", range: "0200-0299" },
      {
        id: "0300-0399",
        title: "Ethics and Morality",
        range: "0300-0399",
        children: [
          { id: "0301", title: "Ethical Action", range: "0301", isLeaf: true }
        ]
      },
      { id: "0400-0499", title: "Political Philosophy", range: "0400-0499" },
      {
        id: "0500-0599",
        title: "Aesthetics and Philosophy of Art",
        range: "0500-0599",
        children: [
          { id: "0501", title: "Creative Process", range: "0501", isLeaf: true }
        ]
      },
      {
        id: "0600-0699",
        title: "Philosophy of Mind",
        range: "0600-0699",
        children: [
          { id: "0601", title: "Intellectual Pursuit", range: "0601", isLeaf: true }
        ]
      },
      { id: "0700-0799", title: "Existentialism and Phenomenology", range: "0700-0799" },
      { id: "0800-0899", title: "Philosophy of Religion", range: "0800-0899" },
      { id: "0900-0999", title: "Applied Ethics", range: "0900-0999" },
    ]
  },
  {
    id: "1000",
    title: "History and Civilization",
    range: "1000-1999",
    children: [
      { id: "1000-1099", title: "Prehistory and Early Human Civilizations", range: "1000-1099" },
      { id: "1100-1199", title: "Ancient History", range: "1100-1199" },
      { id: "1200-1299", title: "Medieval History", range: "1200-1299" },
      { id: "1300-1399", title: "Early Modern History", range: "1300-1399" },
      { id: "1400-1499", title: "Modern History", range: "1400-1499" },
      { id: "1500-1599", title: "Political History", range: "1500-1599" },
      { id: "1600-1699", title: "Economic History", range: "1600-1699" },
      { id: "1700-1799", title: "Social and Cultural History", range: "1700-1799" },
      { id: "1800-1899", title: "History of Science, Technology, and Medicine", range: "1800-1899" },
      { id: "1900-1999", title: "Historiography and Historical Methodology", range: "1900-1999" },
    ]
  },
  {
    id: "2000",
    title: "Science and Nature",
    range: "2000-2999",
    children: [
      { id: "2000-2099", title: "Physics", range: "2000-2099" },
      { id: "2100-2199", title: "Chemistry", range: "2100-2199" },
      { id: "2200-2299", title: "Biology", range: "2200-2299" },
      { id: "2300-2399", title: "Earth Sciences", range: "2300-2399" },
      { id: "2400-2499", title: "Astronomy and Space Science", range: "2400-2499" },
      { id: "2500-2599", title: "Ecology and Environmental Science", range: "2500-2599" },
      { id: "2600-2699", title: "Mathematics and Statistics", range: "2600-2699" },
      { id: "2700-2799", title: "Medicine and Health Sciences", range: "2700-2799" },
      { id: "2800-2899", title: "Computer Science and Artificial Intelligence", range: "2800-2899" },
      { id: "2900-2999", title: "Interdisciplinary and Applied Sciences", range: "2900-2999" },
    ]
  },
  {
    id: "3000",
    title: "Psychology and Human Behavior",
    range: "3000-3999",
    children: [
      {
        id: "3000-3099",
        title: "Cognitive Psychology",
        range: "3000-3099",
        children: [
          { id: "3001", title: "Linguistics", range: "3001", isLeaf: true }
        ]
      },
      { id: "3100-3199", title: "Behavioral Psychology", range: "3100-3199" },
      { id: "3200-3299", title: "Developmental Psychology", range: "3200-3299" },
      { id: "3300-3399", title: "Personality Psychology", range: "3300-3399" },
      { id: "3400-3499", title: "Social Psychology", range: "3400-3499" },
      {
        id: "3500-3599",
        title: "Emotions and Motivation",
        range: "3500-3599",
        children: [
          { id: "3501", title: "Success", range: "3501", isLeaf: true }
        ]
      },
      { id: "3600-3699", title: "Clinical Psychology", range: "3600-3699" },
      { id: "3700-3799", title: "Neuroscience and Biological Psychology", range: "3700-3799" },
      { id: "3800-3899", title: "Health and Positive Psychology", range: "3800-3899" },
      { id: "3900-3999", title: "Industrial-Organizational and Applied Psychology", range: "3900-3999" },
    ]
  },
  {
    id: "4000",
    title: "Sociology and Culture",
    range: "4000-4999",
    children: [
      { id: "4000-4099", title: "Foundations of Sociology", range: "4000-4099" },
      { id: "4100-4199", title: "Social Stratification and Class", range: "4100-4199" },
      { id: "4200-4299", title: "Sex, Gender Roles, and Biological Differences", range: "4200-4299" },
      { id: "4300-4399", title: "Race and Ethnicity", range: "4300-4399" },
      { id: "4400-4499", title: "Family and Relationships", range: "4400-4499" },
      { id: "4500-4599", title: "Religion and Belief Systems", range: "4500-4599" },
      {
        id: "4600-4699",
        title: "Culture, Media, and Communication",
        range: "4600-4699",
        children: [
          { id: "4601", title: "Etymology", range: "4601", isLeaf: true },
          { id: "4602", title: "Journalism", range: "4602", isLeaf: true }
        ]
      },
      { id: "4700-4799", title: "Urbanization and Communities", range: "4700-4799" },
      { id: "4800-4899", title: "Education and Socialization", range: "4800-4899" },
      { id: "4900-4999", title: "Deviance, Crime, and Social Control", range: "4900-4999" },
    ]
  },
  {
    id: "5000",
    title: "Politics, Law, and Governance",
    range: "5000-5999",
    children: [
      { id: "5000-5099", title: "Political Theory", range: "5000-5099" },
      { id: "5100-5199", title: "Comparative Politics", range: "5100-5199" },
      { id: "5200-5299", title: "International Relations", range: "5200-5299" },
      { id: "5300-5399", title: "Public Policy and Administration", range: "5300-5399" },
      { id: "5400-5499", title: "Constitutional Law", range: "5400-5499" },
      { id: "5500-5599", title: "Criminal Law and Justice", range: "5500-5599" },
      { id: "5600-5699", title: "Human Rights and Civil Liberties", range: "5600-5699" },
      { id: "5700-5799", title: "Political Economy", range: "5700-5799" },
      { id: "5800-5899", title: "Political Behavior and Public Opinion", range: "5800-5899" },
      { id: "5900-5999", title: "Governance and Development", range: "5900-5999" },
    ]
  },
  {
    id: "6000",
    title: "Economics and Finance",
    range: "6000-6999",
    children: [
      { id: "6000-6099", title: "Microeconomics", range: "6000-6099" },
      { id: "6100-6199", title: "Macroeconomics", range: "6100-6199" },
      { id: "6200-6299", title: "International Economics", range: "6200-6299" },
      { id: "6300-6399", title: "Development Economics", range: "6300-6399" },
      { id: "6400-6499", title: "Behavioral Economics", range: "6400-6499" },
      { id: "6500-6599", title: "Financial Economics", range: "6500-6599" },
      { id: "6600-6699", title: "Public Finance", range: "6600-6699" },
      { id: "6700-6799", title: "Labor Economics", range: "6700-6799" },
      { id: "6800-6899", title: "Environmental Economics", range: "6800-6899" },
      { id: "6900-6999", title: "Economic History and Thought", range: "6900-6999" },
    ]
  },
  {
    id: "7000",
    title: "Art and Aesthetics",
    range: "7000-7999",
    children: [
      { id: "7000-7099", title: "History of Art", range: "7000-7099" },
      { id: "7100-7199", title: "Art Theory and Criticism", range: "7100-7199" },
      { id: "7200-7299", title: "Visual Arts", range: "7200-7299" },
      { id: "7300-7399", title: "Performing Arts", range: "7300-7399" },
      { id: "7400-7499", title: "Literary Arts", range: "7400-7499" },
      { id: "7500-7599", title: "Applied Arts and Design", range: "7500-7599" },
      { id: "7600-7699", title: "Cultural Aesthetics", range: "7600-7699" },
      { id: "7700-7799", title: "Art and Technology", range: "7700-7799" },
      { id: "7800-7899", title: "Art and Society", range: "7800-7899" },
      { id: "7900-7999", title: "Art Education and Engagement", range: "7900-7999" },
    ]
  },
  {
    id: "8000",
    title: "Technology and Innovation",
    range: "8000-8999",
    children: [
      { id: "8000-8099", title: "History of Technology", range: "8000-8099" },
      { id: "8100-8199", title: "Information Technology", range: "8100-8199" },
      { id: "8200-8299", title: "Communication Technology", range: "8200-8299" },
      { id: "8300-8399", title: "Engineering and Manufacturing", range: "8300-8399" },
      { id: "8400-8499", title: "Biotechnology and Health Technology", range: "8400-8499" },
      { id: "8500-8599", title: "Energy Technology", range: "8500-8599" },
      { id: "8600-8699", title: "Environmental Technology", range: "8600-8699" },
      { id: "8700-8799", title: "Transportation Technology", range: "8700-8799" },
      { id: "8800-8899", title: "Emerging Technologies", range: "8800-8899" },
      { id: "8900-8999", title: "Technology and Society", range: "8900-8999" },
    ]
  },
  {
    id: "9000",
    title: "Personal Development and Practical Skills",
    range: "9000-9999",
    children: [
      {
        id: "9000-9099",
        title: "Self-Awareness and Personal Growth",
        range: "9000-9099",
        children: [
          { id: "9001", title: "Personal Philosophy", range: "9001", isLeaf: true },
          { id: "9002", title: "Clarity and Decision Making", range: "9002", isLeaf: true },
          { id: "9003", title: "Agency", range: "9003", isLeaf: true },
          { id: "9004", title: "Purpose", range: "9004", isLeaf: true }
        ]
      },
      {
        id: "9100-9199",
        title: "Time Management and Productivity",
        range: "9100-9199",
        children: [
          { id: "9101", title: "Reading", range: "9101", isLeaf: true },
          { id: "9102", title: "Intentional Time Management", range: "9102", isLeaf: true }
        ]
      },
      { id: "9200-9299", title: "Communication Skills", range: "9200-9299" },
      { id: "9300-9399", title: "Leadership and Teamwork", range: "9300-9399" },
      { id: "9400-9499", title: "Critical Thinking and Problem Solving", range: "9400-9499" },
      {
        id: "9500-9599",
        title: "Financial Literacy and Money Management",
        range: "9500-9599",
        children: [
          { id: "9501", title: "Zero-Based Budgeting", range: "9501", isLeaf: true }
        ]
      },
      { id: "9600-9699", title: "Health and Wellness", range: "9600-9699" },
      { id: "9700-9799", title: "Career Development and Professional Skills", range: "9700-9799" },
      { id: "9800-9899", title: "Creativity and Innovation", range: "9800-9899" },
      { id: "9900-9999", title: "Practical Skills and Hobbies", range: "9900-9999" },
    ]
  },
];

export default antinetCategories;