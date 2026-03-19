import React from 'react';
import { Appointment } from '../types';
import { Calendar, Clock, User, CheckCircle, XCircle, Clock3, Ban } from 'lucide-react';
import { Button } from './Button';

interface AppointmentCardProps {
  appointment: Appointment;
  onCancel?: (id: string) => void;
}

export const AppointmentCard: React.FC<AppointmentCardProps> = ({ appointment, onCancel }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'confirmed':
        return {
          color: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
          icon: <CheckCircle size={12} />,
          label: 'Confirmed'
        };
      case 'cancelled':
        return {
          color: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
          icon: <Ban size={12} />,
          label: 'Cancelled'
        };
      default:
        return {
          color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
          icon: <Clock3 size={12} />,
          label: 'Pending'
        };
    }
  };

  const statusConfig = getStatusConfig(appointment.status);

  return (
    <div className={`
      p-4 rounded-xl border shadow-sm flex flex-col gap-3 transition-all hover:shadow-md
      bg-white border-slate-200 
      dark:bg-slate-800 dark:border-slate-700
    `}>
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
            <div className="p-2 bg-teal-50 text-teal-600 rounded-lg dark:bg-teal-900/50 dark:text-teal-400">
                <User size={18} />
            </div>
            <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{appointment.doctorName}</h3>
                <p className="text-xs text-slate-500 uppercase tracking-wider dark:text-slate-400">{appointment.specialty}</p>
            </div>
        </div>
        <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${statusConfig.color}`}>
            {statusConfig.icon} {statusConfig.label}
        </span>
      </div>
      
      <div className="border-t border-slate-100 dark:border-slate-700 pt-3 flex gap-4 text-sm text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-slate-400 dark:text-slate-500" />
            <span>{appointment.date}</span>
        </div>
        <div className="flex items-center gap-1.5">
            <Clock size={14} className="text-slate-400 dark:text-slate-500" />
            <span>{appointment.time}</span>
        </div>
      </div>
      
      <div className="bg-slate-50 p-2 rounded text-xs text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
        <span className="font-medium text-slate-700 dark:text-slate-300">Reason:</span> {appointment.reason}
      </div>

      {appointment.status !== 'cancelled' && onCancel && (
        <div className="pt-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            onClick={() => onCancel(appointment.id)}
          >
            Cancel Appointment
          </Button>
        </div>
      )}
    </div>
  );
};