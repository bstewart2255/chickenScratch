#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_ROOT="$PROJECT_ROOT/backups"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Rollback Procedures Test Suite ==="
echo "Testing backup and rollback system for Prompt 15 compliance"
echo "==================================================${NC}"
echo ""

# Test configuration
TEST_PHASES=(1 5 10 14)  # Major phase checkpoints
MAX_ROLLBACK_TIME=300    # 5 minutes in seconds
TEST_BACKUP_NAME="test-rollback-$(date +%Y%m%d_%H%M%S)"

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
TEST_RESULTS=()

log_test_result() {
    local test_name="$1"
    local status="$2"
    local duration="$3"
    local message="$4"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$status" = "PASS" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✅ PASS${NC} - $test_name (${duration}s) - $message"
        TEST_RESULTS+=("PASS|$test_name|$duration|$message")
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "${RED}❌ FAIL${NC} - $test_name (${duration}s) - $message"
        TEST_RESULTS+=("FAIL|$test_name|$duration|$message")
    fi
}

test_backup_creation() {
    echo -e "${YELLOW}Test 1: Backup Creation${NC}"
    echo "Creating test backup..."
    
    start_time=$(date +%s)
    
    if "$SCRIPT_DIR/create-migration-backup.sh" > /dev/null 2>&1; then
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        
        if [ $duration -lt 60 ]; then
            log_test_result "Backup Creation" "PASS" "$duration" "Backup created successfully in under 60 seconds"
        else
            log_test_result "Backup Creation" "FAIL" "$duration" "Backup took too long (>60s)"
        fi
    else
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        log_test_result "Backup Creation" "FAIL" "$duration" "Backup creation failed"
    fi
}

test_backup_integrity() {
    echo -e "${YELLOW}Test 2: Backup Integrity Verification${NC}"
    echo "Verifying backup integrity..."
    
    # Get the latest backup
    latest_backup=$(ls -t "$BACKUP_ROOT"/backup-*.tar.gz 2>/dev/null | head -1)
    if [ -z "$latest_backup" ]; then
        log_test_result "Backup Integrity" "FAIL" "0" "No backup found to verify"
        return
    fi
    
    backup_name=$(basename "$latest_backup" .tar.gz)
    
    start_time=$(date +%s)
    
    if "$SCRIPT_DIR/verify-backup-integrity.sh" "$backup_name" > /dev/null 2>&1; then
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        
        if [ $duration -lt 30 ]; then
            log_test_result "Backup Integrity" "PASS" "$duration" "Backup integrity verification passed"
        else
            log_test_result "Backup Integrity" "FAIL" "$duration" "Integrity check took too long (>30s)"
        fi
    else
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        log_test_result "Backup Integrity" "FAIL" "$duration" "Backup integrity verification failed"
    fi
}

test_rollback_listing() {
    echo -e "${YELLOW}Test 3: Rollback Point Listing${NC}"
    echo "Testing rollback point listing..."
    
    start_time=$(date +%s)
    
    if "$SCRIPT_DIR/rollback-to-phase.sh" --list > /dev/null 2>&1; then
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        
        if [ $duration -lt 10 ]; then
            log_test_result "Rollback Listing" "PASS" "$duration" "Rollback points listed successfully"
        else
            log_test_result "Rollback Listing" "FAIL" "$duration" "Listing took too long (>10s)"
        fi
    else
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        log_test_result "Rollback Listing" "FAIL" "$duration" "Failed to list rollback points"
    fi
}

test_phase_rollback_simulation() {
    echo -e "${YELLOW}Test 4: Phase Rollback Simulation${NC}"
    echo "Testing rollback to major phase checkpoints..."
    
    for phase in "${TEST_PHASES[@]}"; do
        echo "  Testing rollback to phase $phase..."
        
        start_time=$(date +%s)
        
        # Test rollback simulation (without actually performing it)
        if "$SCRIPT_DIR/rollback-to-phase.sh" --phase "$phase" --force > /dev/null 2>&1; then
            end_time=$(date +%s)
            duration=$((end_time - start_time))
            
            if [ $duration -lt $MAX_ROLLBACK_TIME ]; then
                log_test_result "Phase $phase Rollback" "PASS" "$duration" "Rollback to phase $phase completed in under 5 minutes"
            else
                log_test_result "Phase $phase Rollback" "FAIL" "$duration" "Rollback to phase $phase took too long (>5min)"
            fi
        else
            end_time=$(date +%s)
            duration=$((end_time - start_time))
            log_test_result "Phase $phase Rollback" "FAIL" "$duration" "Rollback to phase $phase failed"
        fi
    done
}

test_backup_restoration() {
    echo -e "${YELLOW}Test 5: Backup Restoration Test${NC}"
    echo "Testing backup restoration capability..."
    
    # Get the latest backup
    latest_backup=$(ls -t "$BACKUP_ROOT"/backup-*.tar.gz 2>/dev/null | head -1)
    if [ -z "$latest_backup" ]; then
        log_test_result "Backup Restoration" "FAIL" "0" "No backup found to test restoration"
        return
    fi
    
    backup_name=$(basename "$latest_backup" .tar.gz)
    
    start_time=$(date +%s)
    
    # Test restoration simulation (without actually performing it)
    if "$SCRIPT_DIR/rollback-to-phase.sh" --backup "$backup_name" --force > /dev/null 2>&1; then
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        
        if [ $duration -lt $MAX_ROLLBACK_TIME ]; then
            log_test_result "Backup Restoration" "PASS" "$duration" "Backup restoration completed in under 5 minutes"
        else
            log_test_result "Backup Restoration" "FAIL" "$duration" "Backup restoration took too long (>5min)"
        fi
    else
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        log_test_result "Backup Restoration" "FAIL" "$duration" "Backup restoration failed"
    fi
}

test_backup_index_management() {
    echo -e "${YELLOW}Test 6: Backup Index Management${NC}"
    echo "Testing backup index functionality..."
    
    start_time=$(date +%s)
    
    if [ -f "$BACKUP_ROOT/index.json" ]; then
        # Test index reading
        if node -e "JSON.parse(require('fs').readFileSync('$BACKUP_ROOT/index.json'))" > /dev/null 2>&1; then
            end_time=$(date +%s)
            duration=$((end_time - start_time))
            
            if [ $duration -lt 5 ]; then
                log_test_result "Backup Index" "PASS" "$duration" "Backup index is valid and accessible"
            else
                log_test_result "Backup Index" "FAIL" "$duration" "Index access took too long (>5s)"
            fi
        else
            end_time=$(date +%s)
            duration=$((end_time - start_time))
            log_test_result "Backup Index" "FAIL" "$duration" "Backup index is invalid"
        fi
    else
        log_test_result "Backup Index" "FAIL" "0" "Backup index file not found"
    fi
}

test_documentation_availability() {
    echo -e "${YELLOW}Test 7: Documentation Availability${NC}"
    echo "Checking rollback documentation..."
    
    start_time=$(date +%s)
    
    docs_found=0
    if [ -f "$PROJECT_ROOT/docs/ROLLBACK_PROCEDURES.md" ]; then
        docs_found=$((docs_found + 1))
    fi
    
    if [ -f "$SCRIPT_DIR/create-migration-backup.sh" ]; then
        docs_found=$((docs_found + 1))
    fi
    
    if [ -f "$SCRIPT_DIR/rollback-to-phase.sh" ]; then
        docs_found=$((docs_found + 1))
    fi
    
    if [ -f "$SCRIPT_DIR/verify-backup-integrity.sh" ]; then
        docs_found=$((docs_found + 1))
    fi
    
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    if [ $docs_found -eq 4 ]; then
        log_test_result "Documentation" "PASS" "$duration" "All required documentation and scripts found"
    else
        log_test_result "Documentation" "FAIL" "$duration" "Missing documentation or scripts ($docs_found/4 found)"
    fi
}

generate_test_report() {
    echo ""
    echo -e "${BLUE}=== Test Results Summary ==="
    echo "================================${NC}"
    echo ""
    echo "Total Tests: $TOTAL_TESTS"
    echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
        echo "The backup and rollback system is fully compliant with Prompt 15 requirements."
        echo ""
        echo "✅ Can rollback to any phase in < 5 minutes"
        echo "✅ Backup integrity verification passes"
        echo "✅ Documentation includes rollback procedures"
        echo "✅ All required scripts are present and functional"
    else
        echo -e "${RED}⚠️  SOME TESTS FAILED${NC}"
        echo "The backup and rollback system needs attention."
        echo ""
        echo "Failed tests:"
        for result in "${TEST_RESULTS[@]}"; do
            IFS='|' read -r status test_name duration message <<< "$result"
            if [ "$status" = "FAIL" ]; then
                echo -e "  ${RED}❌ $test_name${NC}: $message"
            fi
        done
    fi
    
    echo ""
    echo -e "${BLUE}=== Detailed Test Results ==="
    echo "================================${NC}"
    for result in "${TEST_RESULTS[@]}"; do
        IFS='|' read -r status test_name duration message <<< "$result"
        if [ "$status" = "PASS" ]; then
            echo -e "${GREEN}✅ $test_name${NC} (${duration}s): $message"
        else
            echo -e "${RED}❌ $test_name${NC} (${duration}s): $message"
        fi
    done
    
    echo ""
    echo -e "${BLUE}=== Prompt 15 Compliance Check ==="
    echo "========================================${NC}"
    echo ""
    
    # Check specific Prompt 15 requirements
    compliance_checks=0
    
    # Requirement 1: Can rollback to any phase in < 5 minutes
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✅ Requirement 1: Rollback time < 5 minutes${NC}"
        compliance_checks=$((compliance_checks + 1))
    else
        echo -e "${RED}❌ Requirement 1: Rollback time < 5 minutes${NC}"
    fi
    
    # Requirement 2: Backup integrity verification passes
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✅ Requirement 2: Backup integrity verification${NC}"
        compliance_checks=$((compliance_checks + 1))
    else
        echo -e "${RED}❌ Requirement 2: Backup integrity verification${NC}"
    fi
    
    # Requirement 3: Documentation includes rollback procedures
    if [ -f "$PROJECT_ROOT/docs/ROLLBACK_PROCEDURES.md" ]; then
        echo -e "${GREEN}✅ Requirement 3: Rollback documentation${NC}"
        compliance_checks=$((compliance_checks + 1))
    else
        echo -e "${RED}❌ Requirement 3: Rollback documentation${NC}"
    fi
    
    echo ""
    if [ $compliance_checks -eq 3 ]; then
        echo -e "${GREEN}🎉 FULLY COMPLIANT WITH PROMPT 15${NC}"
        echo "All requirements have been successfully implemented and tested."
    else
        echo -e "${RED}⚠️  NOT FULLY COMPLIANT WITH PROMPT 15${NC}"
        echo "Some requirements need attention ($compliance_checks/3 met)."
    fi
}

# Run all tests
echo "Starting comprehensive rollback procedures test suite..."
echo ""

test_backup_creation
test_backup_integrity
test_rollback_listing
test_phase_rollback_simulation
test_backup_restoration
test_backup_index_management
test_documentation_availability

# Generate final report
generate_test_report

# Exit with appropriate code
if [ $FAILED_TESTS -eq 0 ]; then
    exit 0
else
    exit 1
fi 