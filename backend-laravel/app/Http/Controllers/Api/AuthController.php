<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    /**
     * Autentikasi Admin untuk mengontrol sistem SI PEKA.
     * Endpoint: POST /api/auth/login
     */
    public function login(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Username dan password wajib diisi.',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $inputUsername = $request->input('username');
        $inputPassword = $request->input('password');

        // Kredensial Admin default (dapat disesuaikan di .env)
        $adminUser = env('ADMIN_USERNAME', 'admin');
        $adminPass = env('ADMIN_PASSWORD', 'admin123');

        if ($inputUsername === $adminUser && $inputPassword === $adminPass) {
            // Buat token sesi admin
            $token = 'sipeka_' . bin2hex(random_bytes(24));

            return response()->json([
                'status'  => 'success',
                'message' => 'Login berhasil. Selamat datang Administrator.',
                'token'   => $token,
                'user'    => [
                    'username' => 'admin',
                    'name'     => 'Administrator SI PEKA',
                    'role'     => 'admin',
                ],
            ], 200);
        }

        return response()->json([
            'status'  => 'error',
            'message' => 'Username atau password salah! Akses ditolak.',
        ], 401);
    }

    /**
     * Logout Admin.
     * Endpoint: POST /api/auth/logout
     */
    public function logout(): JsonResponse
    {
        return response()->json([
            'status'  => 'success',
            'message' => 'Berhasil logout dari sistem.',
        ], 200);
    }
}
