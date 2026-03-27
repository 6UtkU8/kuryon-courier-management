import { DirectorPermissionKey } from './director-permission.model';

export type DirectorShiftStatus = 'Online' | 'Offline' | 'Mola';
export type DirectorEmploymentStatus = 'Aktif' | 'Pasif' | 'Isten Cikti';

export interface Director {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  shiftStatus: DirectorShiftStatus;
  employmentStatus: DirectorEmploymentStatus;
  permissions: DirectorPermissionKey[];
}
