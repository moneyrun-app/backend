import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './common/supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FinanceModule } from './finance/finance.module';
import { SimulationModule } from './simulation/simulation.module';
import { PacemakerModule } from './pacemaker/pacemaker.module';
import { BookModule } from './book/book.module';
import { PaymentModule } from './payment/payment.module';
import { ConstantsModule } from './constants/constants.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    AuthModule,
    UsersModule,
    FinanceModule,
    SimulationModule,
    PacemakerModule,
    BookModule,
    PaymentModule,
    ConstantsModule,
  ],
})
export class AppModule {}
