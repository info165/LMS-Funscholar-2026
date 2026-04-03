export type UserRole = 'admin' | 'teacher' | 'student';
export type UserMode = 'in-school' | 'online';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
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
  type: 'video' | 'pdf' | 'ppt' | 'image' | 'link' | 'doc';
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
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  files: ContentFile[];
  componentIds?: string[];
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
  timestamp: string;
  duration?: number;
  activity: string;
}
