'use client';

import Image from 'next/image';

export interface PrintableMemberValues {
  name: string;
  email: string;
  profilePic?: string;
  age: string;
  dateJoined: string;
  contact: string;
  contact2: string;
  village: string;
  district: string;
  subCounty: string;
  guardianName: string;
  guardianContact: string;
  category: string;
  status: string;
  suspension?: { value: string; unit: string };
}

interface PrintableMemberFormProps {
  values: PrintableMemberValues;
  filled: boolean;
}

function LineField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <div className="border-b border-slate-300 pb-1 pt-0.5 text-sm font-medium text-slate-800 min-h-7">
        {value}
      </div>
    </div>
  );
}

export default function PrintableMemberForm({ values, filled }: PrintableMemberFormProps) {
  const v = (value: string) => (filled ? value : '');
  const suspension = filled && values.suspension ? ` (${values.suspension.value} ${values.suspension.unit})` : '';

  return (
    <div id="printable" className="hidden print:block bg-white text-slate-900 p-10 max-w-[210mm] mx-auto">
      <div className="font-sans space-y-6">

        {/* Minimalist Top Branding / Title */}
        <div className="flex items-center justify-between gap-6 border-b-2 border-slate-900 pb-4">
          <div className="flex items-center gap-4">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 shadow-sm">
              <Image src="/noll.jpg" alt="Noll logo" fill unoptimized className="object-cover" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Official Document</span>
              <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">Noll Member Registration Form</h1>
            </div>
          </div>
        </div>

        {/* Identity Row: Photo + Core Details */}
        <div className="flex items-center gap-8 pt-3">
          <div className="relative flex h-30 w-30 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm ring-1 ring-slate-900/5 text-3xl font-bold uppercase text-slate-400">
            {values.profilePic ? (
              <Image src={values.profilePic} alt="Member photo" fill unoptimized className="object-cover" />
            ) : (
              <span>{values.name ? values.name.charAt(0) : 'N'}</span>
            )}
          </div>

          <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-1">
            <div className="col-span-2">
              <LineField label="Full Name" value={v(values.name)} />
            </div>
            <LineField label="Email Address" value={v(values.email)} />
            <LineField label="Date Joined" value={v(values.dateJoined)} />
          </div>
        </div>

        {/* Section 1: Personal Details */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">
            1. Personal Details
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <LineField label="Age" value={v(values.age)} />
            <LineField label="Category" value={v(values.category)} />
            <div className="col-span-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</span>
              <div className="border-b border-slate-300 pb-1 pt-0.5 text-sm font-medium text-slate-800 min-h-7">
                {v(values.status)}
                <span className="text-amber-600 font-normal">{suspension}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Contact & Location */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 pb-1">
            2. Contact &amp; Location
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <LineField label="Contact Number" value={v(values.contact)} />
            <LineField label="Alternative Contact" value={v(values.contact2)} />
            <LineField label="Village" value={v(values.village)} />
            <LineField label="Sub County" value={v(values.subCounty)} />
            <div className="col-span-2">
              <LineField label="District" value={v(values.district)} />
            </div>
          </div>
        </div>

        {/* Section 3: Guardian Details */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 pb-1">
            3. Guardian / Parent Details
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <LineField label="Guardian Name" value={v(values.guardianName)} />
            <LineField label="Guardian Contact" value={v(values.guardianContact)} />
          </div>
        </div>

        {/* Signatures */}
        <div className="pt-16 grid grid-cols-2 gap-12">
          <div>
            <div className="border-t border-slate-900 pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Member Signature &amp; Date
              </p>
            </div>
          </div>
          <div>
            <div className="border-t border-slate-900 pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Authorized Representative Signature
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
