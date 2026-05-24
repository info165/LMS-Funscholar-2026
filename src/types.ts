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
}

export interface ContentActivation {
  id: string;
  moduleId: string;
  schoolId: string;
  teacherId: string;
  activated: boolean;
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
  status: 'pending' | 'reviewed';
  rating?: number;
  feedback?: string;
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
