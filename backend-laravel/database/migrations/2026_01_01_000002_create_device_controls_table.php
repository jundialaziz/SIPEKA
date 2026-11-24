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
        Schema::create('device_controls', function (Blueprint $table) {
            $table->id();
            $table->boolean('auto_mode')->default(true)->comment('true = Otomatis (Rule Engine), false = Manual Override');
            $table->boolean('fan_override')->default(false)->comment('Kontrol manual Kipas saat mode manual');
            $table->boolean('pump_override')->default(false)->comment('Kontrol manual Pompa saat mode manual');
            $table->decimal('temp_threshold', 5, 2)->default(45.00)->comment('Batas Suhu Kritis (°C)');
            $table->decimal('gas_threshold', 8, 2)->default(400.00)->comment('Batas Kadar Gas/Asap Kritis');
            $table->string('target_device', 32)->nullable()->comment('Target MAC / ID Perangkat (opsional multi-node)');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('device_controls');
    }
};
