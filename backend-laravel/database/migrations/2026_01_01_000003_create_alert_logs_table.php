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
        Schema::create('alert_logs', function (Blueprint $table) {
            $table->id();
            $table->enum('alert_level', ['AMAN', 'WASPADA', 'BAHAYA']);
            $table->text('message');
            $table->decimal('temperature', 6, 2)->nullable();
            $table->decimal('gas_level', 8, 2)->nullable();
            $table->boolean('sent_to_telegram')->default(false);
            $table->string('telegram_response_id', 64)->nullable();
            $table->timestamps();

            $table->index('alert_level');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('alert_logs');
    }
};
