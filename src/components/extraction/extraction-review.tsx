"use client";

import { useState } from "react";
import type { ExtractedData } from "@/types";
import { Check, X } from "lucide-react";

interface ExtractionReviewProps {
  data: ExtractedData;
  onChange: (data: ExtractedData) => void;
}

/**
 * Renders all extracted fields grouped by type.
 * Each item has a toggle to include/exclude it from the final report.
 * All fields are editable inline.
 *
 * TODO: Add inline edit mode per field (click to edit text).
 * TODO: Add "add item" button per section for manual additions.
 */
export function ExtractionReview({ data, onChange }: ExtractionReviewProps) {
  function toggleAddress(id: string) {
    onChange({
      ...data,
      addresses: data.addresses.map((a) =>
        a.id === id ? { ...a, include_in_report: !a.include_in_report } : a
      ),
    });
  }

  function togglePhone(id: string) {
    onChange({
      ...data,
      phones: data.phones.map((p) =>
        p.id === id ? { ...p, include_in_report: !p.include_in_report } : p
      ),
    });
  }

  function toggleVehicle(id: string) {
    onChange({
      ...data,
      vehicles: data.vehicles.map((v) =>
        v.id === id ? { ...v, include_in_report: !v.include_in_report } : v
      ),
    });
  }

  function toggleAssociate(id: string) {
    onChange({
      ...data,
      associates: data.associates.map((a) =>
        a.id === id ? { ...a, include_in_report: !a.include_in_report } : a
      ),
    });
  }

  function toggleEmployment(id: string) {
    onChange({
      ...data,
      employment: data.employment.map((e) =>
        e.id === id ? { ...e, include_in_report: !e.include_in_report } : e
      ),
    });
  }

  const isEmpty =
    data.addresses.length === 0 &&
    data.phones.length === 0 &&
    data.vehicles.length === 0 &&
    data.associates.length === 0 &&
    data.employment.length === 0;

  if (isEmpty) {
    return (
      <div className="rounded-lg border border-[#2a2f42] bg-[#161922] p-8 text-center">
        <p className="text-sm text-[#8b90a0]">
          No fields were extracted. You can add information manually in the
          report editor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {data.people.length > 0 && (
        <ReviewSection title="Subject Information">
          {data.people.map((person) => (
            <ReviewRow
              key={person.id}
              label={person.full_name}
              sub={[person.dob ? `DOB: ${person.dob}` : null, person.aliases.length > 0 ? `AKA: ${person.aliases.join(", ")}` : null].filter(Boolean).join(" · ")}
              included={person.include_in_report}
              onToggle={() => {
                onChange({
                  ...data,
                  people: data.people.map((p) =>
                    p.id === person.id
                      ? { ...p, include_in_report: !p.include_in_report }
                      : p
                  ),
                });
              }}
            />
          ))}
        </ReviewSection>
      )}

      {data.addresses.length > 0 && (
        <ReviewSection title="Addresses">
          {data.addresses.map((addr) => (
            <ReviewRow
              key={addr.id}
              label={`${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`}
              sub={addr.date_range_text ?? undefined}
              included={addr.include_in_report}
              onToggle={() => toggleAddress(addr.id)}
            />
          ))}
        </ReviewSection>
      )}

      {data.phones.length > 0 && (
        <ReviewSection title="Phone Numbers">
          {data.phones.map((phone) => (
            <ReviewRow
              key={phone.id}
              label={phone.phone_number}
              sub={phone.phone_type ?? undefined}
              included={phone.include_in_report}
              onToggle={() => togglePhone(phone.id)}
            />
          ))}
        </ReviewSection>
      )}

      {data.vehicles.length > 0 && (
        <ReviewSection title="Vehicles">
          {data.vehicles.map((v) => (
            <ReviewRow
              key={v.id}
              label={[v.year, v.make, v.model].filter(Boolean).join(" ")}
              sub={[v.plate ? `Plate: ${v.plate}` : null, v.state ?? null, v.vin ? `VIN: ${v.vin}` : null].filter(Boolean).join(" · ")}
              included={v.include_in_report}
              onToggle={() => toggleVehicle(v.id)}
            />
          ))}
        </ReviewSection>
      )}

      {data.associates.length > 0 && (
        <ReviewSection title="Associates / Relatives">
          {data.associates.map((a) => (
            <ReviewRow
              key={a.id}
              label={a.name}
              sub={a.relationship_label ?? undefined}
              included={a.include_in_report}
              onToggle={() => toggleAssociate(a.id)}
            />
          ))}
        </ReviewSection>
      )}

      {data.employment.length > 0 && (
        <ReviewSection title="Employment">
          {data.employment.map((e) => (
            <ReviewRow
              key={e.id}
              label={e.employer_name}
              sub={e.role_title ?? undefined}
              included={e.include_in_report}
              onToggle={() => toggleEmployment(e.id)}
            />
          ))}
        </ReviewSection>
      )}
    </div>
  );
}

function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide mb-2">
        {title}
      </p>
      <div className="rounded-lg border border-[#2a2f42] bg-[#161922] divide-y divide-[#1e2130]">
        {children}
      </div>
    </div>
  );
}

function ReviewRow({
  label,
  sub,
  included,
  onToggle,
}: {
  label: string;
  sub?: string;
  included: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={onToggle}
        className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded border transition-colors ${
          included
            ? "bg-[#4f7ef5] border-[#4f7ef5]"
            : "border-[#2a2f42] hover:border-[#4f7ef5]/50"
        }`}
      >
        {included ? <Check size={12} className="text-white" /> : <X size={12} className="text-transparent" />}
      </button>
      <div className="min-w-0">
        <p className={`text-sm truncate ${included ? "text-[#e8eaf0]" : "text-[#8b90a0] line-through"}`}>
          {label}
        </p>
        {sub && (
          <p className="text-xs text-[#8b90a0] truncate">{sub}</p>
        )}
      </div>
    </div>
  );
}
