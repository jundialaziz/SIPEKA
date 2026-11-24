<?php

namespace Database\Seeders;

use App\Models\DeviceControl;
use Illuminate\Database\Seeder;

class DeviceControlSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DeviceControl::firstOrCreate(
            ['id' => 1],
            [
                'auto_mode'      => true,
                'fan_override'   => false,
                'pump_override'  => false,
                'temp_threshold' => 45.0,
                'gas_threshold'  => 400.0,
                'target_device'  => 'ESP32-PRIMARY',
            ]
        );
    }
}
