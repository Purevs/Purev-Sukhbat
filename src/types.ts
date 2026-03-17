export interface User {
  id: string;
  name: string;
  farm_name: string;
  phone: string;
  pin_code: string;
  created_at: string;
  is_approved: boolean;
  role?: 'admin' | 'user';
}

export interface Cow {
  id: string;
  tag_code: string;
  type: 'cow' | 'calf';
  breed: string | null;
  age: number;
  gender: 'male' | 'female' | null;
  mother_tag: string | null;
  birth_date: string | null;
  calvings: number;
  last_calving_date: string | null;
  insemination_date: string | null;
  image_urls: string[];
  notes: string | null;
  created_at: string;
}

export interface MilkYield {
  id: string;
  cow_id: string;
  amount: number;
  date: string;
  session: 'morning' | 'evening';
}

export interface CowDetail extends Cow {
  yields: MilkYield[];
}
