<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DeviceControl extends Model
{
    use HasFactory;

    protected $table = 'device_controls';

    protected $fillable = [
        'auto_mode',
        'fan_override',
        'pump_override',
        'temp_threshold',
        'gas_threshold',
        'target_device',
    ];

    protected $casts = [
        'auto_mode'      => 'boolean',
        'fan_override'   => 'boolean',
        'pump_override'  => 'boolean',
        'temp_threshold' => 'float',
        'gas_threshold'  => 'float',
    ];

    /**
     * Mengambil record kontrol aktif (singleton row).
     * Jika belum ada, otomatis membuat row default.
     */
    public static function getActive(): self
    {
        return self::firstOrCreate(
            ['id' => 1],
            [
                'auto_mode'      => true,
                'fan_override'   => false,
                'pump_override'  => false,
                'temp_threshold' => 45.0,
                'gas_threshold'  => 400.0,
            ]
        );
    }
}
