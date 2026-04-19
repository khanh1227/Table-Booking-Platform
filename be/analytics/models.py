from django.db import models

# Currently, analytics app primarily relies on queries over bookings, payments, and reviews.
# We can add models here later for pre-computed materialized views or reports.
# 
# class ReportTask(models.Model):
#     partner = models.ForeignKey('accounts.Partner', on_delete=models.CASCADE)
#     report_month = models.DateField()
#     total_revenue = models.DecimalField(max_digits=15, decimal_places=2)
#     created_at = models.DateTimeField(auto_now_add=True)
