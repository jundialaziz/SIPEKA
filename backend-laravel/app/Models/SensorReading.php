<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SensorReading extends Model
{
    use HasFactory;

    protected $table = 'sensor_readings';

    protected $fillable = [
        'temperature',
        'gas_level',
        'gas_digital',
        'fan_status',
        'pump_status',
        'alert_level',
        'mac_address',
    ];

    protected $casts = [
        'temperature' => 'float',
        'gas_level'   => 'float',
        'gas_digital' => 'boolean',
        'fan_status'  => 'boolean',
        'pump_status' => 'boolean',
    ];
}
