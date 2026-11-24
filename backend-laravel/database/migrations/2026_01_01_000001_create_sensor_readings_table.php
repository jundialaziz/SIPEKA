<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('sensor_readings', function (Blueprint $table) {
            $table->id();
            $table->decimal('temperature', 6, 2)->comment('Suhu dalam Celcius');
            $table->decimal('gas_level', 8, 2)->comment('Kadar Asap/Gas (PPM / ADC Level)');
            $table->boolean('gas_digital')->default(false)->comment('Trigger digital sensor MQ-2');
            $table->boolean('fan_status')->default(false)->comment('Status Kipas Exhaust (true=ON, false=OFF)');
            $table->boolean('pump_status')->default(false)->comment('Status Pompa Air (true=ON, false=OFF)');
            $table->enum('alert_level', ['AMAN', 'WASPADA', 'BAHAYA'])->default('AMAN');
            $table->string('mac_address', 32)->nullable()->comment('MAC Address Perangkat ESP32');
            $table->timestamps();

            // Index untuk kecepatan query dashboard chart & filtering
            $table->index('created_at');
            $table->index('alert_level');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sensor_readings');
    }
};
