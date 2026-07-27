'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star, MapPin } from 'lucide-react';

interface HostelListing {
  id: string;
  name: string;
  description: string;
  city: string;
  address: string;
  cover_image_url?: string;
  rating: number;
  total_reviews: number;
  amenities: string[];
}

const PLACEHOLDER = "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=900&q=80&auto=format&fit=crop";

export function HostelCard({ hostel }: { hostel: HostelListing }) {
  return (
    <Link
      href={`/hostel/${hostel.id}`}
      className="group block overflow-hidden rounded-2xl bg-card border border-border/50 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <Image
          src={hostel.cover_image_url || PLACEHOLDER}
          alt={hostel.name}
          fill
          loading="lazy"
          className="object-cover transition duration-500 group-hover:scale-110"
        />
        {hostel.rating ? (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-background/95 backdrop-blur px-2.5 py-1 text-xs font-semibold shadow-sm border border-border/50">
            <Star className="h-3.5 w-3.5 fill-primary text-primary" />
            {Number(hostel.rating).toFixed(1)}
          </div>
        ) : null}
      </div>
      <div className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-lg font-semibold tracking-tight group-hover:text-primary transition-colors font-display">
            {hostel.name}
          </h3>
        </div>
        
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 text-primary/70" />
          <span className="line-clamp-1">{hostel.city}</span>
        </p>

        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {hostel.description}
        </p>

        {hostel.amenities && hostel.amenities.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {hostel.amenities.slice(0, 3).map((f) => (
              <span key={f} className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-medium text-primary">
                {f}
              </span>
            ))}
            {hostel.amenities.length > 3 && (
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                +{hostel.amenities.length - 3}
              </span>
            )}
          </div>
        ) : null}
        
        <div className="pt-2">
            <span className="inline-flex items-center text-sm font-semibold text-primary">
                View Details
                <svg className="ml-1 w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="9 5l7 7-7 7" />
                </svg>
            </span>
        </div>
      </div>
    </Link>
  );
}
