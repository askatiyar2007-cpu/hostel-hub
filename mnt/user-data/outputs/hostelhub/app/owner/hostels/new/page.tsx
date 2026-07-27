'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Upload, X } from 'lucide-react';

const hostelSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  contact_number: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  email: z.string().email(),
  amenities: z.string(),
  rules: z.string(),
});

type HostelFormData = z.infer<typeof hostelSchema>;

export default function HostelFormPage() {
  const router = useRouter();
  const params = useParams();
  const { profile } = useAuth();
  const isEditing = !!params.id;
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<HostelFormData>({
    resolver: zodResolver(hostelSchema),
  });

  useEffect(() => {
    if (isEditing && params.id) {
      loadHostelData();
    }
  }, [params.id, isEditing]);

  const loadHostelData = async () => {
    try {
      const { data, error } = await supabase
        .from('hostels')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) throw error;

      if (data) {
        setValue('name', data.name);
        setValue('description', data.description);
        setValue('address', data.address);
        setValue('city', data.city);
        setValue('state', data.state);
        setValue('pincode', data.pincode);
        setValue('contact_number', data.contact_number);
        setValue('email', data.email);
        setValue('amenities', data.amenities?.join(', ') || '');
        setValue('rules', data.rules);
        
        if (data.cover_image_url) {
          setCoverImage(data.cover_image_url);
        }
      }
    } catch (error) {
      toast.error('Failed to load hostel data');
      console.error(error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'gallery') => {
    const files = e.target.files;
    if (!files || !profile?.id) return;

    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error('Image must be less than 5MB');
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `hostel-images/${profile.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('hostels')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('hostels')
          .getPublicUrl(filePath);

        if (type === 'cover') {
          setCoverImage(data.publicUrl);
        } else {
          setGalleryImages([...galleryImages, data.publicUrl]);
        }

        toast.success('Image uploaded successfully');
      }
    } catch (error) {
      toast.error('Failed to upload image');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (formData: HostelFormData) => {
    try {
      setLoading(true);

      const payload = {
        ...formData,
        amenities: formData.amenities.split(',').map(a => a.trim()),
        cover_image_url: coverImage,
        owner_id: profile?.id,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('hostels')
          .update(payload)
          .eq('id', params.id);

        if (error) throw error;
        toast.success('Hostel updated successfully');
      } else {
        const { error } = await supabase
          .from('hostels')
          .insert([payload]);

        if (error) throw error;
        toast.success('Hostel created successfully');
      }

      router.push('/owner/hostels');
    } catch (error) {
      toast.error('Failed to save hostel');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold">
          {isEditing ? 'Edit Hostel' : 'Create New Hostel'}
        </h1>
        <p className="text-muted-foreground mt-2">Fill in the details below</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 card">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="font-bold text-lg">Basic Information</h3>

          <div>
            <label className="block text-sm font-medium mb-2">Hostel Name *</label>
            <input
              {...register('name')}
              placeholder="Enter hostel name"
              className="input w-full"
            />
            {errors.name && <p className="text-destructive text-sm mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description *</label>
            <textarea
              {...register('description')}
              placeholder="Describe your hostel"
              rows={4}
              className="input w-full"
            />
            {errors.description && <p className="text-destructive text-sm mt-1">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email *</label>
              <input
                {...register('email')}
                type="email"
                placeholder="contact@hostel.com"
                className="input w-full"
              />
              {errors.email && <p className="text-destructive text-sm mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Phone *</label>
              <input
                {...register('contact_number')}
                placeholder="9876543210"
                className="input w-full"
              />
              {errors.contact_number && <p className="text-destructive text-sm mt-1">{errors.contact_number.message}</p>}
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="border-t border-border pt-6 space-y-4">
          <h3 className="font-bold text-lg">Location</h3>

          <div>
            <label className="block text-sm font-medium mb-2">Address *</label>
            <input
              {...register('address')}
              placeholder="Street address"
              className="input w-full"
            />
            {errors.address && <p className="text-destructive text-sm mt-1">{errors.address.message}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">City *</label>
              <input
                {...register('city')}
                placeholder="City"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">State *</label>
              <input
                {...register('state')}
                placeholder="State"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Pincode *</label>
              <input
                {...register('pincode')}
                placeholder="100000"
                className="input w-full"
              />
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="border-t border-border pt-6 space-y-4">
          <h3 className="font-bold text-lg">Images</h3>

          <div>
            <label className="block text-sm font-medium mb-2">Cover Image</label>
            {coverImage ? (
              <div className="relative inline-block mb-4">
                <img
                  src={coverImage}
                  alt="Cover"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setCoverImage(null)}
                  className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:bg-muted transition-colors">
                <div className="flex flex-col items-center">
                  <Upload size={32} className="text-muted-foreground mb-2" />
                  <p className="text-sm">Click to upload cover image</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'cover')}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            )}
          </div>
        </div>

        {/* Amenities & Rules */}
        <div className="border-t border-border pt-6 space-y-4">
          <h3 className="font-bold text-lg">Details</h3>

          <div>
            <label className="block text-sm font-medium mb-2">Amenities (comma-separated)</label>
            <textarea
              {...register('amenities')}
              placeholder="WiFi, AC, Hot Water, Laundry, Parking"
              rows={3}
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Rules</label>
            <textarea
              {...register('rules')}
              placeholder="House rules and policies"
              rows={3}
              className="input w-full"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="border-t border-border pt-6 flex gap-4">
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Saving...' : isEditing ? 'Update Hostel' : 'Create Hostel'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/owner/hostels')}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
