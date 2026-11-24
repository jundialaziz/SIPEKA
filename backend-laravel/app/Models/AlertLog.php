<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AlertLog extends Model
{
    use HasFactory;

    protected $table = 'alert_logs';

    protected $fillable = [
        'alert_level',
        'message',
        'temperature',
        'gas_level',
        'sent_to_telegram',
        'telegram_response_id',
    ];

    protected $casts = [
        'temperature'      => 'float',
        'gas_level'        => 'float',
        'sent_to_telegram' => 'boolean',
    ];
}
