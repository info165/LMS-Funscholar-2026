export type UserRole = 'admin' | 'teacher' | 'student';
export type UserMode = 'in-school' | 'online';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  roles?: UserRole[];
  phone?: string;
  password?: string;
  schoolIds?: string[];
  mode?: UserMode;
  xp: number;
  level: number;
  badges: string[];
  lastLogin?: string;
  classSection?: string;
  studentClass?: string;
  section?: string;
  rollNumber?: string;
  photoUrl?: string;
  setupCompleted?: boolean;
  lastActiveModuleId?: string;
  lastActiveStepIdx?: number;
  adminSubRole?: string;
  canAddStudent?: boolean;
  canAddTeacher?: boolean;
  canAddSchool?: boolean;
  canManageContent?: boolean;
  projectPoints?: number;
  quizPoints?: number;
  totalPoints?: number;
  isPasswordPublic?: boolean;
}

export interface School {
  id: string;
  name: string;
  location: string;
  state: string;
}

export interface ContentFile {
  id: string;
  name: string;
  url: string;
  type: 'video' | 'pdf' | 'ppt' | 'image' | 'link' | 'doc' | 'code';
}

export interface Component {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface Course {
  id: string;
  title: string;
  grade: number;
  description: string;
  teacherId: string;
  schoolId: string;
  activated: boolean;
  ageRange?: string;
  courseType?: string;
  subCategory?: string;
  difficulty?: string;
  order?: number;
}

export interface ModuleStep {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  files: ContentFile[];
  componentIds?: string[];
  steps?: ModuleStep[];
  driveUrl?: string;
  videoUrl?: string;
  pptUrl?: string;
  isVisible?: boolean;
  quizQuestions?: QuizQuestion[];
}

export interface ContentActivation {
  id: string;
  moduleId: string;
  schoolId: string;
  teacherId: string;
  activated: boolean;
  classSection?: string;
  section?: string;
}

export interface Project {
  id: string;
  courseId: string;
  moduleId?: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  files: ContentFile[];
  componentIds?: string[];
  driveUrl?: string;
  projectImages?: string[];
  components?: { name: string; imageUrl?: string }[];
  componentsUsed?: string[];
  isVisible?: boolean;
}

export interface Submission {
  id: string;
  projectId: string;
  studentId: string;
  partnerIds?: string[];
  photoUrl?: string;
  videoUrl?: string;
  timestamp: string;
  status: 'pending' | 'reviewed' | 'approved' | 'rejected';
  rating?: number;
  feedback?: string;
  schoolId?: string;
  studentName?: string;
  studentEmail?: string;
  projectTitle?: string;
}

export interface Attendance {
  id: string;
  studentId: string;
  schoolId: string;
  teacherId: string;
  date: string;
  status: 'present' | 'absent';
  timestamp: any;
}

export interface TeacherLog {
  id: string;
  teacherId: string;
  teacherName?: string;
  schoolId: string;
  courseId: string;
  moduleId: string;
  date: string;
  period?: string;
  classSection?: string;
  timestamp: any;
  activity: string;
  duration?: number;
}

export type TransportMode = 'Auto' | 'Bus' | 'Train/Metro' | 'Bike' | 'Personal Vehicle' | 'Others';

export interface ExpenseLeg {
  mode: TransportMode;
  amount: number;
}

export interface ExpenseTemplate {
  id: string;
  teacherId: string;
  schoolId: string;
  totalAmount: number;
  legs: ExpenseLeg[];
  description?: string;
}

export interface ExpenseLog {
  id: string;
  teacherId: string;
  teacherName?: string;
  schoolId: string;
  schoolName?: string;
  totalAmount: number;
  legs: ExpenseLeg[];
  date: string;
  description: string;
  timestamp: any;
  status: 'pending' | 'approved' | 'rejected';
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[]; // exactly 4 options
  correctOptionIdx: number; // index from 0 to 3
}

export interface QuizAttempt {
  id: string;
  studentId: string;
  moduleId: string;
  score: number;
  totalQuestions: number;
  pointsEarned: number;
  completed: boolean;
  timestamp: string;
}

export interface ProjectTheme {
  id: string;
  title: string;
  description: string;
  month: string; // e.g. "June 2026"
  active: boolean;
  createdAt: string;
  stepsHtml?: string; // Steps what they need to do
  rewardDescription?: string; // What they get in return
}

export interface ThematicSubmission {
  id: string;
  themeId: string;
  themeTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  schoolId: string;
  schoolName: string;
  classSection: string;
  photoUrl: string;
  description: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
  teacherFeedback?: string;
  teacherId?: string;
  teacherName?: string;
  pointsAwarded?: number;
}

export interface SimulationLab {
  id: string;
  title: string;
  description: string;
  microcontroller: 'arduino-uno' | 'esp32' | 'pi-pico';
  starterWokwiId?: string;
  testCriteria?: string;
  points: number;
  createdAt: string;
  creatorId: string;
}

export interface SimulationSubmission {
  id: string;
  labId: string;
  labTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  schoolId: string;
  schoolName: string;
  classSection?: string;
  wokwiUrl: string;
  description: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
  teacherFeedback?: string;
  teacherId?: string;
  teacherName?: string;
  pointsAwarded?: number;
}

