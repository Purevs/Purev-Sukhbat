export interface User {
  id: number;
  name: string;
  farm_name: string;
  phone: string;
  pin_code: string;
  created_at: string;
  is_approved: boolean;
}

export interface Cow {
  id: number;
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
  image_data: string | null;
  notes: string | null;
  created_at: string;
}

export interface MilkYield {
  id: number;
  cow_id: number;
  amount: number;
  date: string;
  session: 'morning' | 'evening';
}

export interface CowDetail extends Cow {
  yields: MilkYield[];
}
